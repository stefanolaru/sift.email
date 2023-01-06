const { DynamoDB } = require("@aws-sdk/client-dynamodb"),
    { marshall, unmarshall } = require("@aws-sdk/util-dynamodb"),
    ddb = new DynamoDB();

exports.handler = async (event) => {
    // default authorizer response
    let response = {
        isAuthorized: false,
        context: {
            user_id: null,
        },
    };

    // console.log(event);

    // get user by api key
    let user = await ddb
        .query({
            TableName: process.env.DDB_TABLE,
            IndexName: "GSI",
            KeyConditionExpression: "#GSI = :GSI AND #SK = :SK",
            ExpressionAttributeNames: {
                "#GSI": "GSI",
                "#SK": "SK",
            },
            ExpressionAttributeValues: marshall({
                ":GSI": "apikey",
                ":SK": "apikey#" + event.headers["x-sift-access-token"],
            }),
            ScanIndexForward: false,
            Limit: 1,
        })
        .then((res) => (res.Items.length ? unmarshall(res.Items[0]) : null))
        .catch((err) => {
            console.log(err);
            return null;
        });

    // authorize request if user_id was found
    if (user) {
        response = {
            isAuthorized: true,
            context: {
                user_id: user.PK.replace("user#", ""),
            },
        };
    }
    // return reponse
    return response;
};
