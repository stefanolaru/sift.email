const AWS = require("aws-sdk"),
    ses = new AWS.SES();
// create custom auth challenge
exports.handler = async (event) => {
    let secretLoginCode;
    // new session
    if (!event.request.session || !event.request.session.length) {
        // generate 6 digit code
        secretLoginCode = [...Array(6)]
            .map((_) => (Math.random() * 10) | 0)
            .join("");

        // send email
        await ses
            .sendTemplatedEmail({
                Destination: {
                    ToAddresses: [event.request.userAttributes.email],
                },
                Source:
                    process.env.EMAIL_FROM_NAME +
                    " <" +
                    process.env.EMAIL_FROM_ADDRESS +
                    ">",
                Template: process.env.EMAIL_TEMPLATE,
                TemplateData: JSON.stringify({
                    code: secretLoginCode,
                }),
            })
            .promise()
            .then((res) => console.log(res))
            .catch((err) => console.log(err));
    } else {
        // existing session, keep the code so user can retry
        const previousChallenge = event.request.session.slice(-1)[0];
        secretLoginCode = previousChallenge.challengeMetadata.replace(
            "CODE-",
            ""
        );
    }

    // add email to public challenge params
    event.response.publicChallengeParameters = {
        email: event.request.userAttributes.email,
    };

    // add to code private challenge params so it can be verified
    event.response.privateChallengeParameters = { secretLoginCode };

    // add code to session
    event.response.challengeMetadata = "CODE-" + secretLoginCode;

    return event;
};
