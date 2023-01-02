const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    sns = new AWS.SNS();

exports.handler = async (event) => {
    // no records, stop early
    if (!event.Records || !event.Records.length) return;

    // store previously checked request IDs
    const requestIds = [];

    // update usage on new db entries
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();

        // unmarshal record
        record = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        // extract request ID from GSI (KSUID is always 27 chars length)
        const requestId = record.GSI.substring(0, 26);

        if (!requestIds.includes(requestId)) {
            // add to ids
            requestIds.push(requestId);
            // query request for pending items
            await ddb
                .query({
                    TableName: process.env.DDB_TABLE,
                    IndexName: "GSI",
                    KeyConditionExpression: "#GSI = :GSI",
                    ExpressionAttributeNames: {
                        "#GSI": "GSI",
                    },
                    ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                        ":GSI": requestId + "#pending",
                    }),
                    ScanIndexForward: false,
                    Limit: 1,
                })
                .promise()
                .then((res) => {
                    // if no items pending, publish end message to SNS topic
                    if (!res.Items.length) {
                        // publish message the SNS
                        return sns.publish({
                            Message: JSON.stringify({ requestId: requestId }),
                            TopicArn: process.env.SNS_TOPIC,
                        });
                    } else {
                        return Promise.resolve();
                    }
                })
                .then()
                .catch((err) => {
                    console.log(err);
                });
        }
    }

    return;
};
