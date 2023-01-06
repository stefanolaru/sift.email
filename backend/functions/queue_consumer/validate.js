const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB(),
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
                Key: marshall({
                    PK: item.PK,
                    SK: item.SK,
                }),
                ExpressionAttributeNames: {
                    "#GSI": "GSI",
                    "#result": "result",
                },
                ExpressionAttributeValues: marshall({
                    ":GSI": item.GSI.replace("#pending", "#done"),
                    ":result": result,
                }),
                UpdateExpression: "SET #GSI=:GSI,#result=:result",
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    }
};
