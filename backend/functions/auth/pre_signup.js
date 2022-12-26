const Validator = require("../../libs/validator");

exports.handler = async (event, context, callback) => {
    // validate the email
    const result = await Validator.validateEmail(
        event.request.userAttributes.email
    );

    if (result.error) {
        callback(new Error(result.error), event);
    } else if (result.is_disposable) {
        callback(new Error("Disposable emails are not accepted"), event);
    }

    // auto confirm the user and email on signup, they'll get credits on first login
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;

    // Return to Amazon Cognito
    callback(null, event);
};
