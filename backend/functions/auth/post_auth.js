const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall, unmarshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB();

exports.handler = async (event, context, callback) => {
    // check user ddb profile
    const userProfile = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: marshall({
                PK: "user#" + event.userName,
                SK: "profile",
            }),
        })
        .then((res) => {
            return res.Item ? unmarshall(res.Item) : null;
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
                Item: marshall({
                    PK: "user#" + event.userName,
                    SK: "profile",
                    created_at: Math.floor(ts / 1000),
                    GSI: "user",
                    entity_type: "user",
                    user_email: event.request.userAttributes.email,
                    credits: parseInt(process.env.WELCOME_CREDITS), // free credits on account confirmation
                }),
            })
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
                Key: marshall({
                    PK: "user#" + event.userName,
                    SK: "profile",
                }),
                ExpressionAttributeNames: {
                    "#last_login_at": "last_login_at",
                },
                ExpressionAttributeValues: marshall({
                    ":ts": Math.floor(ts / 1000),
                }),
                UpdateExpression: "SET #last_login_at=:ts",
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    }

    return event;
};
