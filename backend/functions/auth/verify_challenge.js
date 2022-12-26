// checks the auth login code
exports.handler = async (event) => {
    if (
        event.request.challengeAnswer ===
        event.request.privateChallengeParameters.secretLoginCode
    ) {
        event.response.answerCorrect = true;
    } else {
        event.response.answerCorrect = false;
    }
    return event;
};
