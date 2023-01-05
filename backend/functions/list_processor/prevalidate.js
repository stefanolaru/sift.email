const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    s3 = new AWS.S3(),
    sns = new AWS.SNS(),
    eb = new AWS.EventBridge(),
    Validator = require("../../libs/validator"),
    Utils = require("../../libs/utils");

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

    // stop if no metadata
    if (!metadata || !metadata.user_id || !metadata.request_id) {
        return;
    }

    // get column index from ddb
    const request = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: "user#" + metadata.user_id,
                SK: "request#" + metadata.request_id,
            }),
        })
        .promise()
        .then((res) => {
            return res.Item
                ? AWS.DynamoDB.Converter.unmarshall(res.Item)
                : null;
        })
        .catch((err) => {
            console.log(err);
            return null;
        });

    // request not found, stop
    if (!request) return;

    // read index of the email column
    const column_idx = request.column_idx,
        uniqueRecipients = [],
        results = {
            invalid: [], // invalid format, skipped, pushed to S3 invalid
            duplicates: [], // duplicates
            pending: {}, // to be pushed to DynamoDB and for mx/smtp checks
        };

    // init pending count
    let pendingCount = 0;

    // loop data and make the initial validation
    data.forEach((item, idx) => {
        const email = item[column_idx] ? item[column_idx].toLowerCase() : "";
        // if duplicate, drop
        if (uniqueRecipients.includes(email)) {
            results.duplicates.push(item);
        } else {
            // add to unique recipients
            uniqueRecipients.push(email);

            // validate format
            const recipient = Validator.validateFormat(email);

            // add to invalid if error
            if (recipient.error) {
                // ignore first row format error, it's very likely the table header
                if (idx) {
                    results.invalid.push({
                        result: "INVALID",
                        accuracy: "HIGH",
                        note: "Invalid format",
                        email: email,
                    });
                }
            } else {
                const domain = recipient.domain.toLowerCase();
                // create domain key
                if (typeof results.pending[domain] == "undefined") {
                    results.pending[domain] = [];
                }
                // drop directly if disposable or generic role
                if (Validator.isDisposable(domain)) {
                    results.invalid.push({
                        result: "INVALID",
                        accuracy: "HIGH",
                        note: "Disposable domain",
                        email: email,
                    });
                } else if (Validator.isRoleMail(domain)) {
                    results.invalid.push({
                        result: "INVALID",
                        accuracy: "HIGH",
                        note: "Role-based address",
                        email: email,
                    });
                } else {
                    // queue for further validation
                    results.pending[domain].push(recipient.local_part);
                    // increment pending counter
                    pendingCount++;
                }
            }
        }
    });

    // write to S3 initial results
    const promises = [],
        output = {},
        ts = new Date();

    // loop results keys and create files
    ["invalid", "duplicates"].forEach((k) => {
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
                            metadata.user_id +
                            "/" +
                            metadata.request_id +
                            "/" +
                            k +
                            ".json",
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

    // write the prevalidation stats to db before moving forward
    await ddb
        .updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: request.PK,
                SK: request.SK,
            }),
            ExpressionAttributeNames: {
                "#results": "prevalidation_results",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":value": {
                    timestamp: ts.toISOString(),
                    duplicate: results.duplicates.length,
                    invalid: results.invalid.length,
                    pending: pendingCount,
                },
            }),
            UpdateExpression: "SET #results=:value",
        })
        .promise()
        .then()
        .catch((err) => {
            console.log(err);
        });

    // if there are no recipients pending to mx/smtp validation skip directly to results bundling
    // trigger ListValidationEndTopic SNS topic and STOP
    if (!Object.keys(results.pending).length) {
        return await sns
            .publish({
                Message: JSON.stringify({
                    request_id: metadata.request_id,
                }),
                TopicArn: process.env.SNS_TOPIC,
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    // create EventBridge rule to poll the progress
    const ruleCreated = await eb
        .putRule({
            Name: "sift_" + metadata.request_id,
            State: "ENABLED",
            ScheduleExpression: "rate(1 minute)",
        })
        .promise()
        .then((res) => {
            return eb
                .putTargets({
                    Rule: "sift_" + metadata.request_id,
                    Targets: [
                        {
                            Arn: process.env.EB_RULE_TARGET_ARN,
                            Id: "sift_" + metadata.request_id,
                            Input: JSON.stringify({
                                request_id: metadata.request_id,
                            }),
                        },
                    ],
                })
                .promise();
        })
        .then((res) => (!res.FailedEntryCount ? true : false))
        .catch((err) => {
            console.log(err);
            return false;
        });

    // stop if rule wasn't created
    if (!ruleCreated) return;

    // prepare pending items for batch db insert
    const dbItems = [];

    Object.keys(results.pending).forEach((domain) => {
        const shards = Utils.chunkArray(results.pending[domain], 50);
        shards.forEach((v, k) => {
            dbItems.push({
                PutRequest: {
                    Item: AWS.DynamoDB.Converter.marshall({
                        PK: "dc#" + metadata.request_id,
                        SK: domain + "#" + k,
                        GSI: metadata.request_id + "#pending",
                        domain: domain,
                        local_parts: v,
                        created_at: Math.floor(ts / 1000),
                        entity_type: "domain_check",
                        expires_at: Math.floor(ts / 1000) + 24 * 3600, // TTL 24 hours from now
                    }),
                },
            });
        });
    });

    // chunk array into chunks of 25
    const chunks = Utils.chunkArray(dbItems, 25);

    while (chunks.length) {
        // get the first chunk and set the ddb request params
        const chunk = chunks.shift(),
            params = { RequestItems: {}, ReturnConsumedCapacity: "TOTAL" };
        // update params
        params.RequestItems[process.env.DDB_TABLE] = chunk;

        // write
        await ddb
            .batchWriteItem(params)
            .promise()
            .then((res) => {
                // if has UnprocessedItems, push back to chunks
                if (res.UnprocessedItems[process.env.DDB_TABLE]) {
                    chunks.push(res.UnprocessedItems[process.env.DDB_TABLE]);
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    // output counters
    return output;
};
