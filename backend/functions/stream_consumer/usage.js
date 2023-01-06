const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall, unmarshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB();

exports.handler = async (event) => {
    // no records, stop early
    if (!event.Records || !event.Records.length) return;

    // update usage on new db entries
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();

        // unmarshal
        record = unmarshall(record.dynamodb.NewImage);

        // update user entry
        await ddb
            .updateItem({
                TableName: process.env.DDB_TABLE,
                Key: marshall({
                    PK: record.PK,
                    SK: "profile",
                }),
                ExpressionAttributeNames: {
                    "#usage": "usage",
                },
                ExpressionAttributeValues: marshall({
                    ":value": record.usage || 1,
                }),
                UpdateExpression: "ADD #usage :value",
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    }
};
