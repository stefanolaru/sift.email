const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    KSUID = require("ksuid");

exports.handler = async () => {
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

    const user_id = "1234";

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
