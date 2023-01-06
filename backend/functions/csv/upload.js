const { S3 } = require("@aws-sdk/client-s3"),
    s3 = new S3(),
    KSUID = require("ksuid");

exports.handler = async (event) => {
    // gateway headers
    let response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Methods": "POST,OPTIONS",
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

    // data
    let data = null;

    switch (event.rawPath) {
        case "/csv/sign":
            // parse data from event body
            data = JSON.parse(event.body);
            // we have part numbers
            const promises = [];
            if (data.partNumbers) {
                data.partNumbers.forEach((part_no) => {
                    promises.push(
                        s3.getSignedUrlPromise("uploadPart", {
                            Bucket: process.env.S3_BUCKET,
                            Key: data.key,
                            UploadId: data.uploadId,
                            PartNumber: part_no,
                        })
                    );
                });
            } else {
                response.statusCode = 400;
                response.body = JSON.stringify({
                    error: "Zero part numbers",
                });
                return response;
            }

            // wait for promises to resolve
            response.body = { presignedUrls: {} };
            await Promise.all(promises)
                .then((res) => {
                    res.forEach((url, idx) => {
                        response.body.presignedUrls[data.partNumbers[idx]] =
                            url;
                    });
                })
                .catch((err) => console.log(err));

            break;

        // initiate upload
        case "/csv/startupload":
            // create s3 key
            const ts = new Date(),
                ksuid = await KSUID.random(ts),
                key = "temp/" + user_id + "/" + ksuid.string + "/data.csv";

            response.body = await s3
                .createMultipartUpload({
                    Bucket: process.env.S3_BUCKET,
                    Key: key,
                    Metadata: {
                        user_id: user_id.toString(),
                        request_id: ksuid.string.toString(),
                    },
                })
                .then((res) => {
                    return {
                        key: res.Key,
                        uploadId: res.UploadId,
                    };
                })
                .catch((err) => {
                    console.log(err);
                    return { error: err.message };
                });
            break;

        // complete the upload
        case "/csv/completeupload":
            // parse data from event body
            data = JSON.parse(event.body);

            // get csv signed preview url
            const previewUrl = await s3.getSignedUrlPromise("getObject", {
                Bucket: process.env.S3_BUCKET,
                Expires: 600,
                Key: data.key
                    .replace("temp/", "parsed/")
                    .replace("/data.csv", "/preview.json"),
            });

            // complete multipart upload
            response.body = await s3
                .completeMultipartUpload({
                    Bucket: process.env.S3_BUCKET,
                    Key: data.key,
                    UploadId: data.uploadId,
                    MultipartUpload: {
                        Parts: data.parts,
                    },
                })
                .then((res) => {
                    return {
                        key: res.Key,
                        preview_url: previewUrl,
                    };
                })
                .catch((err) => {
                    return { error: err.message };
                });
            break;
    }

    // return stringified response
    response.body = JSON.stringify(response.body);
    return response;
};
