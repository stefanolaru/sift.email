const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    KSUID = require("ksuid");

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

    // no user, no luck ... unlikely thought
    if (!user_id) {
        response.body = JSON.stringify({
            error: "Unauthorized access",
        });
        return response;
    }

    // create key
    const ts = new Date(),
        ksuid = await KSUID.random(ts),
        key = "temp/" + user_id + "/" + ksuid.string + "/data.csv";

    // get signed putObject
    response.body = JSON.stringify({
        upload_url: await s3.getSignedUrlPromise("putObject", {
            Bucket: process.env.S3_BUCKET,
            Key: key,
        }),
        object_key: key,
    });

    // return response
    return response;
};
