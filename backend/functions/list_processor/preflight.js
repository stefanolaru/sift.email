const AWS = require("aws-sdk"),
    s3 = new AWS.S3();

// preflight the domains chunk
exports.handler = async (event) => {
    // get s3 domains file
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

    const batches = [];

    for (var i = 0; i < Math.ceil(items.length / process.env.BATCH_SIZE); i++) {
        batches.push(i * parseInt(process.env.BATCH_SIZE));
    }

    // return meta and the array of batches
    return {
        meta: event.meta,
        batch_size: parseInt(process.env.BATCH_SIZE),
        batches,
    };
};
