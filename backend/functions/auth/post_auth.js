const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB();

exports.handler = async (event, context, callback) => {
    // check user ddb profile
    const userProfile = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: "user#" + event.userName,
                SK: "profile",
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

    const ts = new Date();
    if (!userProfile) {
        // create user profile with welcome credits
        await ddb
            .putItem({
                TableName: process.env.DDB_TABLE,
                Item: AWS.DynamoDB.Converter.marshall({
                    PK: "user#" + event.userName,
                    SK: "profile",
                    created_at: Math.floor(ts / 1000),
                    GSI: "user",
                    entity_type: "user",
                    user_email: event.request.userAttributes.email,
                    credits: parseInt(process.env.WELCOME_CREDITS), // free credits on account confirmation
                }),
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
                return null;
            });
    } else {
        // update user profile with the last login timestamp
        await ddb
            .updateItem({
                TableName: process.env.DDB_TABLE,
                Key: AWS.DynamoDB.Converter.marshall({
                    PK: "user#" + event.userName,
                    SK: "profile",
                }),
                ExpressionAttributeNames: {
                    "#last_login_at": "last_login_at",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":ts": Math.floor(ts / 1000),
                }),
                UpdateExpression: "SET #last_login_at=:ts",
            })
            .promise()
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    return event;
};
