const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB();

exports.handler = async (event) => {
    // get the message from event
    while (event.Records.length) {
        // get the first record
        let record = event.Records.shift();
        // parse body JSON
        const item = JSON.parse(record.body);
        //
        console.log(item);
    }
};
