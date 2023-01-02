const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB();

exports.handler = async (event) => {
    // no records, stop early
    if (!event.Records || !event.Records.length) return;

    // update usage on new db entries
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();

        // unmarshal
        record = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        // update user entry
        await ddb
            .updateItem({
                TableName: process.env.DDB_TABLE,
                Key: AWS.DynamoDB.Converter.marshall({
                    PK: record.PK,
                    SK: "profile",
                }),
                ExpressionAttributeNames: {
                    "#usage": "usage",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":value": record.usage || 1,
                }),
                UpdateExpression: "ADD #usage :value",
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }
};
