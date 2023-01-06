const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall, unmarshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB();

exports.handler = async (event) => {
    // gateway headers
    let response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json; charset=utf-8",
        },
        body: null,
    };

    // get user_id from authorizer
    const user_id = event.requestContext.authorizer.jwt.claims.sub || null;

    response.body = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: marshall({
                PK: "user#" + user_id,
                SK: "profile",
            }),
            ExpressionAttributeNames: {
                "#credits": "credits",
                "#usage": "usage",
                "#created_at": "created_at",
                "#user_name": "user_name",
                "#user_email": "user_email",
            },
            ProjectionExpression:
                "#credits, #usage, #created_at, #user_name, #user_email",
        })
        .then((res) => {
            return res.Item ? unmarshall(res.Item) : null;
        })
        .catch((err) => {
            console.log(err);
            return null;
        });

    response.body = JSON.stringify(response.body);
    return response;
};
