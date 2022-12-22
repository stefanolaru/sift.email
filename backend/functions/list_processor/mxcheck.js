const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    Validator = require("../../libs/validator");

exports.handler = async (event) => {
    // read the import file
    const items = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key:
                "chunks/" +
                event.meta.user_id +
                "/" +
                event.meta.request_id +
                "/domains.json",
        })
        .promise()
        .then((res) => JSON.parse(res.Body.toString("utf-8")))
        .catch((err) => {
            console.log(err);
            return [];
        });

    // extract the batch by index
    const batch = items.slice(event.batch, event.batch + event.batch_size),
        invalid = [],
        promises = [];

    // build up promises
    batch.forEach((domain) => {
        // check domain MX records
        promises.push(Validator.mxQuery(domain));
    });

    // wait for dns to resolve
    await Promise.allSettled(promises)
        .then((res) => {
            res.forEach((r, idx) => {
                // if promise doesn't fulfill, add to invalid
                if (r.status != "fulfilled") {
                    invalid.push(batch[idx]);
                }
            });
        })
        .catch((err) => {
            console.log(err);
        });

    // return boolean, step functions can't perform array.length() at this time
    return {
        meta: event.meta,
        // bucket & key_prefix to be used by the S3 upload step
        bucket: process.env.S3_BUCKET,
        key_prefix:
            "chunks/" + event.meta.user_id + "/" + event.meta.request_id + "/",
        invalid: invalid.length ? invalid : false,
        batch: event.batch,
    };
};
