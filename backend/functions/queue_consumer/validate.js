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

        // validate the entire domain
        const result = await Validator.validateDomain(
            item.domain,
            item.local_parts,
            5000
        )
            .then()
            .catch((err) => {
                console.log(err);
                return null;
            });

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
                    "#result": "result",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":GSI": item.GSI.replace("#pending", "#done"),
                    ":result": result,
                }),
                UpdateExpression: "SET #GSI=:GSI,#result=:result",
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }
};
