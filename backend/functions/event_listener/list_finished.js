const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
ddb = new DynamoDB();
//
exports.handler = async (event) => {
    // parse message json
    const msg = JSON.parse(event.Records[0].Sns.Message),
        meta = msg.meta,
        ts = new Date();

    // remove from message
    delete msg.meta;
    // update user entry
    await ddb
        .updateItem({
            TableName: process.env.DDB_TABLE,
            Key: marshall({
                PK: "user#" + meta.user_id + "#request",
                SK: meta.request_id,
            }),
            ExpressionAttributeNames: {
                "#result": "result",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: marshall({
                ":result": msg,
                ":updated_at": Math.floor(ts / 1000),
            }),
            UpdateExpression: "SET #result=:result, #updated_at=:updated_at",
        })
        .then()
        .catch((err) => {
            console.log(err);
        });

    return true;
};
