const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB(),
    s3 = new AWS.S3();

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
    if (!data || !data.csv_id) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({ error: "Bad request" });
        return response;
    }

    // read preview file for the provided csv ID
    const preview = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: "parsed/" + user_id + "/" + data.csv_id + "/preview.json",
        })
        .promise()
        .then((res) => JSON.parse(res.Body.toString("utf-8")))
        .catch((err) => {
            console.log(err);
            return null;
        });

    if (!preview) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({
            error: "They key could not be found",
        });
        return response;
    }

    // get user usage
    const userProfile = await ddb
        .getItem({
            TableName: process.env.DDB_TABLE,
            Key: AWS.DynamoDB.Converter.marshall({
                PK: "user#" + user_id,
                SK: "profile",
            }),
            ExpressionAttributeNames: {
                "#credits": "credits",
                "#usage": "usage",
            },
            ProjectionExpression: "#credits, #usage",
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

    // check quota, stop if not enough credits
    if (userProfile.credits - userProfile.usage <= preview.total_rows) {
        // stop
        response.statusCode = 400;
        response.body = JSON.stringify({
            error: "Not enough credits",
        });
        return response;
    }

    // generate timestamp & ksuid
    const ts = new Date();

    // copy data into input
    await s3
        .copyObject({
            Bucket: process.env.S3_BUCKET,
            CopySource:
                "/" +
                process.env.S3_BUCKET +
                "/parsed/" +
                user_id +
                "/" +
                data.csv_id +
                "/data.json",
            Key: "input/" + user_id + "/" + data.csv_id + "/data.json",
        })
        .promise()
        .then(() => {
            ddb.putItem({
                TableName: process.env.DDB_TABLE,
                Item: AWS.DynamoDB.Converter.marshall({
                    PK: "user#" + user_id,
                    SK: "request#" + data.csv_id,
                    created_at: Math.floor(ts / 1000),
                    GSI: "request#private",
                    entity_type: "request",
                    column_idx: column_idx,
                    usage: preview.total_rows,
                }),
            }).promise();
        })
        .then(() => {
            response.body = {
                request_id: data.csv_id,
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
