const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    Validator = require("../../libs/validator");

exports.handler = async (event) => {
    // no object, no fun
    if (!event.detail || !event.detail.object) return;

    // read data.json
    const { metadata, data } = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: event.detail.object.key,
        })
        .promise()
        .then((res) => {
            return {
                metadata: res.Metadata,
                data: JSON.parse(res.Body.toString("utf-8")),
            };
        })
        .catch((err) => {
            console.log(err);
            return {
                metadata: null,
                data: null,
            };
        });

    // read index of the email column
    const column_idx = metadata.column_idx ? parseInt(metadata.column_idx) : 0,
        keyPrefix = event.detail.object.key
            .replace("input/", "chunks/")
            .replace("/data.json", "/"),
        uniqueRecipients = [],
        results = {
            valid: [],
            invalid: [],
            duplicates: [],
            pending: [],
            domains: [],
        };

    // loop data and make the initial validation
    data.forEach((item, idx) => {
        // if duplicate, drop
        if (uniqueRecipients.includes(item[column_idx])) {
            results.duplicates.push({
                idx: idx,
                data: item,
                error: "Duplicate",
            });
        } else {
            // add to unique recipients
            uniqueRecipients.push(item[column_idx]);

            // validate format
            const recipient = Validator.checkFormat(item[column_idx]);

            // add to invalid if error
            if (recipient.error) {
                results.invalid.push({
                    idx: idx,
                    data: item,
                    error: recipient.error,
                });
            } else {
                // drop directly if disposable or role
                if (
                    Validator.isDisposable(recipient.domain) ||
                    Validator.isRoleMail(recipient.domain)
                ) {
                    results.invalid.push({
                        idx: idx,
                        data: item,
                        error: "Disposable domain",
                    });
                } else if (Validator.isFreeMail(recipient.domain)) {
                    // assume valid if free
                    results.valid.push({
                        idx: idx,
                        data: item,
                    });
                } else {
                    //
                    results.pending.push({
                        idx: idx,
                        data: item,
                    });

                    // get unique domains to be validated
                    if (!results.domains.includes(recipient.domain)) {
                        results.domains.push(recipient.domain);
                    }
                }
            }
        }
    });

    // write to S3 initial results
    const promises = [],
        output = {};
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
                        Key: keyPrefix + k + ".json",
                        ContentType: "application/json",
                    })
                    .promise()
            );
        }
    });

    // wait for s3 objects to be uploaded
    if (promises) {
        await Promise.allSettled(promises)
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    // add key prefix to output
    Object.assign(output, {
        meta: metadata,
    });

    // output counters
    return output;
};
