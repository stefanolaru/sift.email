const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    sns = new AWS.SNS(),
    ddb = new AWS.DynamoDB(),
    Papa = require("papaparse");

// this gets triggered only via SNS, reads payload from message
exports.handler = async (event) => {
    // get request_id
    const msg = JSON.parse(event.Records[0].Sns.Message),
        { request_id } = msg;

    // get the list validation request info
    const request = await ddb
        .query({
            TableName: process.env.DDB_TABLE,
            IndexName: "GSI",
            KeyConditionExpression: "#GSI = :GSI AND #SK = :SK",
            ExpressionAttributeNames: {
                "#GSI": "GSI",
                "#SK": "SK",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":GSI": "request#private",
                ":SK": "request#" + request_id,
            }),
            ScanIndexForward: false,
            Limit: 1,
        })
        .promise()
        .then((res) => {
            return res.Items.length
                ? AWS.DynamoDB.Converter.unmarshall(res.Items[0])
                : null;
        })
        .catch((err) => {
            console.log(err);
            return null;
        });

    // unlikely, but still
    if (!request) {
        return;
    }

    // extract user_id from PK
    const user_id = request.PK.replace("user#", "");

    // pull the processed items from the db table and add to db items
    let lek = null,
        dbItems = [];

    // first do :)
    do {
        // default params
        const params = {
            TableName: process.env.DDB_TABLE,
            KeyConditionExpression: "#PK = :PK",
            ExpressionAttributeNames: {
                "#PK": "PK",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":PK": "dc#" + request_id,
            }),
            ScanIndexForward: false,
            Limit: 250,
        };

        // add ExclusiveStartKey if lek is present
        if (lek) {
            Object.assign(params, {
                ExclusiveStartKey: lek,
            });
        }

        await ddb
            .query(params)
            .promise()
            .then((res) => {
                // update key
                lek = res.LastEvaluatedKey ? res.LastEvaluatedKey : null;
                //
                if (res.Items.length) {
                    // loop all items and push into dbItems
                    res.Items.forEach((item) => {
                        // unmarshal item
                        item = AWS.DynamoDB.Converter.unmarshall(item);

                        if (item.result) {
                            // extract invalid local parts
                            const invalidLocalParts = [];
                            // process invalid recipients first
                            if (item.result.recipients.invalid) {
                                item.result.recipients.invalid.forEach((v) => {
                                    invalidLocalParts.push(v.local_part);
                                    // add to dbItems
                                    dbItems.push({
                                        result: "INVALID",
                                        accuracy: v.accuracy,
                                        note: "Recipient does not exist",
                                        email: v.local_part + "@" + item.domain,
                                    });
                                });
                            }
                            // remove invalid localparts from localparts, extract difference
                            const localParts = item.local_parts.filter(
                                (x) => !invalidLocalParts.includes(x)
                            );

                            // if any valid local parts are left, add to dbItems
                            if (localParts) {
                                localParts.forEach((v) => {
                                    const validRecipient = {
                                        result: item.result.domain.result,
                                        accuracy: item.result.domain.accuracy,
                                        note: item.result.domain.note || "",
                                        email: v + "@" + item.domain,
                                    };
                                    // add recipient to list
                                    dbItems.push(validRecipient);
                                });
                            }
                        }
                    });
                }
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    } while (lek);

    // read invalid results stored in S3 by prevalidator
    const s3Items = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: "output/" + user_id + "/" + request_id + "/invalid.json",
        })
        .promise()
        .then((res) => JSON.parse(res.Body.toString("utf-8")))
        .catch((err) => {
            console.log(err);
            return [];
        }); // return empty array if no items were dropped on prevalidation

    // combine items from DB with the S3 ones
    const resultItems = dbItems.concat(s3Items),
        resultMap = {};
    resultItems.forEach((v) => {
        resultMap[v.email] = v;
    });

    // get the original parse data
    const parsedJson = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: "parsed/" + user_id + "/" + request_id + "/data.json",
        })
        .promise()
        .then((res) => JSON.parse(res.Body.toString("utf-8")))
        .catch((err) => {
            console.log(err);
            return null;
        });

    // prepare the output
    const valid = [],
        invalid = [];

    // loop the original JSON and append validation results
    parsedJson.forEach((row, idx) => {
        const key = row[request.column_idx].toLowerCase();
        const res = resultMap[key];
        if (res) {
            // append result, accuracy, notes columns
            row.push(...[res.result, res.accuracy, res.note]);
            // set in categories
            if (res.result == "VALID") {
                valid.push(row);
            } else {
                invalid.push(row);
            }
        } else {
            // append empty columns
            row.push(...(!idx ? ["Result", "Accuracy", "Note"] : ["", "", ""]));
        }
    });

    // write the validation stats to db before moving forward
    const ts = new Date(),
        stats = {
            timestamp: ts.toISOString(),
            invalid: invalid.length,
            valid: valid.length,
            total: parsedJson.length,
        };
    await ddb
        .updateItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: request.PK,
                SK: request.SK,
            }),
            ExpressionAttributeNames: {
                "#results": "validation_results",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":value": stats,
            }),
            UpdateExpression: "SET #results=:value",
        })
        .promise()
        .then()
        .catch((err) => {
            console.log(err);
        });

    // write the json results

    const resultsS3Prefix = "output/" + user_id + "/" + request_id + "/results",
        s3Promises = [
            // full results JSON
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: JSON.stringify(parsedJson),
                    Key: resultsS3Prefix + "/full.json",
                    ContentType: "application/json",
                })
                .promise(),
            // full results CSV
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: Papa.unparse(parsedJson),
                    Key: resultsS3Prefix + "/full.csv",
                    ContentType: "text/csv",
                })
                .promise(),
            // valid results JSON
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: JSON.stringify(valid),
                    Key: resultsS3Prefix + "/valid.json",
                    ContentType: "application/json",
                })
                .promise(),
            // valid results CSV
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: Papa.unparse(valid),
                    Key: resultsS3Prefix + "/valid.csv",
                    ContentType: "text/csv",
                })
                .promise(),
            // invalid results JSON
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: JSON.stringify(invalid),
                    Key: resultsS3Prefix + "/invalid.json",
                    ContentType: "application/json",
                })
                .promise(),
            // invalid results CSV
            s3
                .upload({
                    Bucket: process.env.S3_BUCKET,
                    Body: Papa.unparse(invalid),
                    Key: resultsS3Prefix + "/invalid.csv",
                    ContentType: "text/csv",
                })
                .promise(),
        ];

    await Promise.allSettled(s3Promises)
        .then()
        .catch((err) => {
            console.log(err);
        });

    // trigger SNS topic
    await sns
        .publish({
            Message: JSON.stringify(event),
            TopicArn: process.env.SNS_TOPIC,
        })
        .promise()
        .then()
        .catch((err) => {
            console.log(err);
        });

    // wooohoo, we're done!

    // return the stats
    return stats;
};
