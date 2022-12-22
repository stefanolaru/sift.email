const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    Papa = require("papaparse");

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

    const key =
        event.queryStringParameters && event.queryStringParameters.key
            ? event.queryStringParameters.key
            : null;

    if (!key) {
        response.statusCode = 400;
        response.body = JSON.stringify({
            error: "Missing key querystring parameter",
        });
        return response;
    }

    // read JSON
    response.body = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: key,
        })
        .promise()
        .then((res) => {
            // extract first row
            const parsed = Papa.parse(res.Body.toString("utf-8"));
            if (parsed.data && parsed.data.length) {
                // return header and total rows
                return {
                    first_row: parsed.data.shift(),
                    total_rows: parsed.data.length,
                };
            } else {
                return { error: "Could not parse CSV file" };
            }
        })
        .catch((err) => {
            console.log(err);
            return null;
        });

    // stringify body
    response.body = JSON.stringify(response.body);
    return response;
};
