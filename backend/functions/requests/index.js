const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB();

exports.handler = async (event) => {
    // prepare the response object
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json; charset=utf-8",
        },
        body: "",
    };

    // get user_id from authorizers
    const user_id = (() => {
        if (event.requestContext.authorizer.jwt) {
            return event.requestContext.authorizer.jwt.claims.sub;
        } else if (event.requestContext.authorizer.lambda) {
            return event.requestContext.authorizer.lambda.user_id;
        } else {
            return null;
        }
    })();

    // no user, no luck ... unlikely thought
    if (!user_id) {
        response.body = JSON.stringify({
            error: "Unauthorized access",
        });
        return response;
    }

    // register request
    response.body = await ddb
        .query({
            TableName: process.env.DDB_TABLE,
            KeyConditionExpression: "#PK = :PK AND begins_with(#SK,:prefix)",
            ExpressionAttributeNames: {
                "#PK": "PK",
                "#SK": "SK",
            },
            ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                ":PK": "user#" + user_id,
                ":prefix": "request#",
            }),
            ScanIndexForward: false,
        })
        .promise()
        .then((res) => {
            const items = [];
            if (res.Items.length) {
                res.Items.forEach((item) =>
                    items.push(AWS.DynamoDB.Converter.unmarshall(item))
                );
            }
            return items;
        })
        .catch((err) => {
            console.log(err);
            return [];
        });

    // set response
    response.body = JSON.stringify(response.body);

    // push final response
    return response;
};
