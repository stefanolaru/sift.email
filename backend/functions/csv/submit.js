const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    s3 = new AWS.S3(),
    Papa = require("papaparse"),
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
    const data = JSON.parse(event.body),
        column_idx = parseInt(data.column_idx || 0);

    // stop if no data
    if (!data || !data.key) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({ error: "Bad request" });
        return response;
    }

    // read csv -> JSON
    const jsonData = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: data.key,
        })
        .promise()
        .then((res) => {
            // extract first row
            const parsed = Papa.parse(res.Body.toString("utf-8"));
            return parsed.data || null;
        })
        .catch((err) => {
            console.log(err);
            return null;
        });

    if (!jsonData) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({ error: "CSV could not be found" });
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
        usage = jsonData.length || 0;

    // check quota, stop if not enough credits
    if (credits <= usage) {
        // stop
        response.statusCode = 403;
        response.body = JSON.stringify({
            error: "Not enough credits",
        });
        return response;
    }

    // generate timestamp & ksuid
    const ts = new Date(),
        ksuid = await KSUID.random(ts);

    // new key for json data
    let jsonKey = "input/" + user_id + "/" + ksuid.string + "/data.json";

    // register request
    await s3
        .upload({
            Bucket: process.env.S3_BUCKET,
            Body: JSON.stringify(jsonData),
            Key: jsonKey,
            ContentType: "application/json",
            Metadata: {
                user_id: user_id.toString(),
                request_id: ksuid.string.toString(),
                column_idx: column_idx.toString(),
            },
        })
        .promise()
        .then(() => {
            ddb.putItem({
                TableName: process.env.DDB_TABLE,
                Item: AWS.DynamoDB.Converter.marshall({
                    PK: "user#" + user_id + "#request",
                    SK: ksuid.string,
                    created_at: Math.floor(ts / 1000),
                    GSI: "request",
                    entity_type: "request",
                    column_idx: column_idx,
                    usage: jsonData.length, // json length
                }),
            }).promise();
        })
        .then(() => {
            response.body = {
                request_id: ksuid.string,
            };
        })
        .catch((err) => {
            console.log(err);
            response.body = {
                error: "An error occured",
            };
        });

    // set response
    response.body = JSON.stringify(response.body);

    return response;
};
