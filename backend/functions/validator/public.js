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
                "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
                "Content-Type": "application/json; charset=utf-8",
            },
            body: "",
        },
        ipAddress = event.headers["x-forwarded-for"] || null;

    // rate limiting
    if (process.env.RATE_LIMIT_MAX_REQUESTS) {
        // check previous requests
        const requestCount = await ddb
            .query({
                TableName: process.env.DDB_TABLE,
                IndexName: "PK_CREATED",
                KeyConditionExpression: "#PK = :PK",
                ExpressionAttributeNames: {
                    "#PK": "PK",
                },
                ExpressionAttributeValues: AWS.DynamoDB.Converter.marshall({
                    ":PK": "public#" + ipAddress,
                }),
                ScanIndexForward: false,
                Limit: process.env.RATE_LIMIT_MAX_REQUESTS,
            })
            .promise()
            .then((res) => res.Items.length || 0)
            .catch((err) => {
                console.log(err);
                return 0;
            });

        // stop if rate limit exceeded
        if (requestCount >= process.env.RATE_LIMIT_MAX_REQUESTS) {
            // stop
            response.statusCode = 429;
            response.body = JSON.stringify({ error: "Too many requests" });
            return response;
        }
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

    // validate email address
    response.body = await Validator.validateEmail(data.email);

    // generate timestamp & ksuid
    const ts = new Date(),
        ksuid = await KSUID.random(ts);

    // write request to DB
    await ddb
        .putItem({
            TableName: process.env.DDB_TABLE,
            Item: AWS.DynamoDB.Converter.marshall({
                PK: "public#" + ipAddress,
                SK: ksuid.string,
                created_at: Math.floor(ts / 1000),
                GSI: "request",
                entity_type: "request",
                expires_at:
                    Math.floor(ts / 1000) +
                    parseInt(process.env.RATE_LIMIT_INTERVAL),
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
