const AWS = require("aws-sdk"),
    ddb = new AWS.DynamoDB();

exports.handler = async (event, context, callback) => {
    // auto set the pricing plan for admin invited users to starter
    console.log(event);

    // Return to Amazon Cognito
    callback(null, event);
};
