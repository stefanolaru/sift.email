const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    Validator = require("../../libs/validator"),
    KSUID = require("ksuid");

exports.handler = async (event) => {
    // prepare the response object
    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Content-Type": "application/json; charset=utf-8",
        },
        body: "",
    };

    // get user_id from authorizer
    const user_id = event.requestContext.authorizer.jwt.claims.sub || null;

    // no user, no luck ... unlikely thought
    if (!user_id) {
        response.body = JSON.stringify({
            error: "Unauthorized access",
        });
        return response;
    }

    // read and parse data
    const data = JSON.parse(event.body);

    // stop if no data
    if (!data || !data.email) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({ error: "Bad request" });
        return response;
    }

    const userProfile = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: "user#" + user_id,
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

    // check quota, stop if not enough credits
    if (!userProfile || !userProfile.credits) {
        // stop
        response.statusCode = 403;
        response.body = JSON.stringify({
            error: "Not allowed to perform the operation",
        });
        return response;
    }

    const credits = userProfile.credits || 0,
        usage = userProfile.usage || 0;

    // check quota, stop if not enough credits
    if (credits <= usage) {
        // stop
        response.statusCode = 403;
        response.body = JSON.stringify({
            error: "Not enough credits",
        });
        return response;
    }

    // validate input
    response.body = await Validator.validateEmail(data.email);

    // generate timestamp & ksuid
    const ts = new Date(),
        ksuid = await KSUID.random(ts);

    // register request
    await ddb
        .putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall({
                PK: "user#" + user_id + "#request",
                SK: ksuid.string,
                created_at: Math.floor(ts / 1000),
                GSI: "request#private",
                entity_type: "request",
                usage: 1, // number of submitted recipients
            }),
        })
        .promise()
        .then()
        .catch((err) => {
            console.log(err);
        });

    // set response
    response.body = JSON.stringify(response.body);

    return response;
};
