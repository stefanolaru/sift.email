const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    Validator = require("../../libs/validator");

exports.handler = async (event) => {
    // loop messages
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();
        // parse body JSON
        const item = JSON.parse(record.body);
        // get MX records, max 5s timeout per domain
        const mx = await Validator.mxQuery(item.domain, 5000)
            .then((res) => res)
            .catch((err) => {
                return null;
            });

        // error
        let error = null;

        if (!mx) {
            //
            error = "NO_MX";
        }

        // update dc entry with the domain validation result
        await ddb
            .updateItem({
                TableName: process.env.DDB_TABLE,
                Key: AWS.DynamoDB.Converter.marshall({
                    PK: item.PK,
                    SK: item.SK,
                }),
                ExpressionAttributeNames: {
                    "#GSI": "GSI",
                    "#error": "error",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":GSI": item.GSI.replace("#pending", "#done"),
                    ":error": error,
                }),
                UpdateExpression: "SET #GSI=:GSI,#error=:error",
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }
};
