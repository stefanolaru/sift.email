const { S3 } = require("@aws-sdk/client-s3"),
    s3 = new S3(),
    Papa = require("papaparse");

exports.handler = async (event) => {
    let key = event.detail.object.key;
    // get object
    const { metadata, data } = await s3
        .getObject({
            Bucket: process.env.S3_BUCKET,
            Key: key,
        })
        .then((res) => {
            return {
                metadata: res.Metadata,
                data: res.Body,
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

    const parsed = Papa.parse(await data.transformToString("utf-8"));
    if (parsed.data && parsed.data.length) {
        // return header and total rows
        await s3
            .putObject({
                Bucket: process.env.S3_BUCKET,
                Body: JSON.stringify(parsed.data),
                Key:
                    "parsed/" +
                    metadata.user_id +
                    "/" +
                    metadata.request_id +
                    "/data.json",
                ContentType: "application/json",
                Metadata: {
                    user_id: metadata.user_id,
                    request_id: metadata.request_id,
                },
            })
            .then(() => {
                // write the data preview
                return s3.putObject({
                    Bucket: process.env.S3_BUCKET,
                    Body: JSON.stringify({
                        preview: parsed.data.slice(0, 14), // get the first 15 items
                        total_rows: parsed.data.length,
                        csv_id: metadata.request_id,
                    }),
                    Key:
                        "parsed/" +
                        metadata.user_id +
                        "/" +
                        metadata.request_id +
                        "/preview.json",
                    ContentType: "application/json",
                });
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
