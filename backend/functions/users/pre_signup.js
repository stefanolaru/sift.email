const disposable = require("disposable-email-domains");

exports.handler = async (event, context, callback) => {
    // set default plan to free
    var email = event.request.userAttributes.email;
    var ecomp = email.split("@");

    if (disposable.includes(ecomp[1])) {
        callback(new Error("Sorry, disposable emails won't work."), event);
    }

    // Return to Amazon Cognito
    callback(null, event);
};
