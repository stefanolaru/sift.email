const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB(),
    { SNS } = require("@aws-sdk/client-sns"),
    sns = new SNS(),
    { EventBridge } = require("@aws-sdk/client-eventbridge"),
    eb = new EventBridge();

exports.handler = async (event) => {
    // query request for pending items
    const hasPending = await ddb
        .query({
            TableName: process.env.DDB_TABLE,
            IndexName: "GSI",
            KeyConditionExpression: "#GSI = :GSI",
            ExpressionAttributeNames: {
                "#GSI": "GSI",
            },
            ExpressionAttributeValues: marshall({
                ":GSI": event.request_id + "#pending",
            }),
            ScanIndexForward: false,
            Limit: 1,
        })
        .then((res) => (res.Items ? res.Items.length : 1))
        .catch((err) => {
            console.log(err);
            return 1;
        });

    // no more pending items, validation finished
    if (!hasPending) {
        // send SNS
        await sns
            .publish({
                Message: JSON.stringify(event),
                TopicArn: process.env.SNS_TOPIC,
            })
            .then()
            .catch((err) => {
                console.log(err);
            });

        // delete the poller
        await eb
            .removeTargets({
                Ids: ["sift_" + event.request_id],
                Rule: "sift_" + event.request_id,
            })
            .then((res) => {
                return eb.deleteRule({
                    Name: "sift_" + event.request_id,
                });
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    return;
};
