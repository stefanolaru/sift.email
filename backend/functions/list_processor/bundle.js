const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    Validator = require("../../libs/validator");

exports.handler = async (event) => {
    let promises = [],
        invalidDomains = [];

    // read invalid domains
    await s3
        .listObjectsV2({
            Bucket: process.env.S3_BUCKET,
            Prefix:
                "chunks/" +
                event.meta.user_id +
                "/" +
                event.meta.request_id +
                "/" +
                "invalid-domains/",
        })
        .promise()
        .then((res) => {
            if (res.Contents) {
                res.Contents.forEach((item) => {
                    // add to promises
                    promises.push(
                        s3
                            .getObject({
                                Bucket: process.env.S3_BUCKET,
                                Key: item.Key,
                            })
                            .promise()
                    );
                });
            }
        })
        .catch((err) => {
            console.log(err);
        });

    if (promises.length) {
        await Promise.allSettled(promises)
            .then((res) => {
                res.forEach((r) => {
                    if (r.status == "fulfilled") {
                        // populate chunks into invalid domains
                        invalidDomains.push(
                            ...JSON.parse(r.value.Body.toString("utf-8"))
                        );
                    }
                });
            })
            .catch((err) => {
                console.log(err);
            });
    }

    // prep results object to finalize validation
    const results = {},
        chunkKeys = ["valid", "invalid", "pending", "duplicates"];

    // cleanup previous promises
    promises = [];

    // read chunks
    chunkKeys.forEach((k) => {
        promises.push(
            s3
                .getObject({
                    Bucket: process.env.S3_BUCKET,
                    Key:
                        "chunks/" +
                        event.meta.user_id +
                        "/" +
                        event.meta.request_id +
                        "/" +
                        k +
                        ".json",
                })
                .promise()
        );
    });

    // wait for files to be read
    await Promise.allSettled(promises)
        .then((res) => {
            res.forEach((r, idx) => {
                if (r.status == "fulfilled") {
                    // populate chunks into results
                    results[chunkKeys[idx]] = JSON.parse(
                        r.value.Body.toString("utf-8")
                    );
                } else {
                    // set empty array, the file failed to read
                    results[chunkKeys[idx]] = [];
                }
            });
        })
        .catch((err) => {
            console.log(err);
        });

    // validate pending, if any
    if (results.pending.length) {
        results.pending.forEach((item) => {
            const res = Validator.checkFormat(item.data[3]);
            if (invalidDomains.includes(res.domain)) {
                results.invalid.push(
                    Object.assign(item, {
                        error: "No MX entries",
                    })
                );
            } else {
                results.valid.push(item);
            }
        });
        // delete the key from results, not needed anymore
        delete results.pending;
    }

    // cleanup previous promises
    promises = [];

    // prepare the output, upload results
    const output = {
        meta: event.meta,
    };

    // loop results keys and create files
    Object.keys(results).forEach((k) => {
        // update output with counter
        output[k] = results[k].length;
        //
        if (output[k] > 0) {
            promises.push(
                s3
                    .upload({
                        Bucket: process.env.S3_BUCKET,
                        Body: JSON.stringify(results[k]),
                        Key:
                            "output/" +
                            event.meta.user_id +
                            "/" +
                            event.meta.request_id +
                            "/" +
                            k +
                            ".json",
                        ContentType: "application/json",
                    })
                    .promise()
            );
        }
    });

    // wait for final s3 objects to be uploaded
    if (promises) {
        await Promise.allSettled(promises)
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    // return the stats
    return output;
};
