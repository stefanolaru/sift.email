const AWS = require("aws-sdk"),
    s3 = new AWS.S3(),
    Papa = require("papaparse");

exports.handler = async (event) => {
    let key = event.detail.object.key;
    // get object
    const { metadata, data } = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: key,
        })
        .promise()
        .then((res) => {
            return {
                metadata: res.Metadata,
                data: res.Body.toString("utf-8"),
            };
        })
        .catch((err) => {
            console.log(err);
            return {
                metadata: null,
                data: null,
            };
        });

    // no csv, stop early
    if (!data) return;

    const parsed = Papa.parse(data);
    if (parsed.data && parsed.data.length) {
        // return header and total rows
        await s3
            .upload({
                Bucket: process.env.S3_BUCKET,
                Body: JSON.stringify(parsed.data),
                Key:
                    "parsed/" +
                    metadata.user_id +
                    "/" +
                    metadata.request_id +
                    "/data.json",
                ContentType: "application/json",
            })
            .promise()
            .then((res) => {
                // write the data preview
                return s3
                    .upload({
                        Bucket: process.env.S3_BUCKET,
                        Body: JSON.stringify({
                            preview: parsed.data.slice(0, 14), // get the first 15
                            total_rows: parsed.data.length,
                        }),
                        Key:
                            "parsed/" +
                            metadata.user_id +
                            "/" +
                            metadata.request_id +
                            "/preview.json",
                        ContentType: "application/json",
                    })
                    .promise();
            })
            .then()
            .catch((err) => {
                console.log(err);
            });
    } else {
        console.log({ error: "Could not parse CSV file", key: key });
        return;
    }
};
