const AWS = require("aws-sdk"),
    sqs = new AWS.SQS(),
    Utils = require("../../libs/utils");

exports.handler = async (event) => {
    // no records, stop early
    if (!event.Records || !event.Records.length) return;

    const sqsMessages = [],
        sqsPromises = [];

    // update usage on new db entries
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();

        // unmarshal record
        record = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        // generate batch ID
        const sqsId = (record.PK + record.SK).replace(/[\#\.]/g, "-");

        sqsMessages.push({
            Id: sqsId,
            MessageBody: JSON.stringify(record),
        });
    }

    // publish messages to SQS
    if (sqsMessages.length) {
        Utils.chunkArray(sqsMessages, 10).forEach((chunk) => {
            sqsPromises.push(
                sqs
                    .sendMessageBatch({
                        Entries: chunk,
                        QueueUrl: process.env.QUEUE,
                    })
                    .promise()
            );
        });

        // wait for the sqs messages to be published
        await Promise.allSettled(sqsPromises)
            .then((res) => {
                // !!! handle UnprocessedItems
                console.log(res);
            })
            .catch((err) => {
                console.log(err);
            });
    }

    return sqsMessages.length;
};
