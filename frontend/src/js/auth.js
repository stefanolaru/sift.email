import {
    AuthenticationDetails,
    CognitoUserPool,
    CognitoUser,
    CognitoUserAttribute,
} from "amazon-cognito-identity-js";

// user pool
const userPool = new CognitoUserPool({
    UserPoolId: process.env.UserPoolId,
    ClientId: process.env.UserPoolWebClientId,
});

const setUser = (username) =>
    new CognitoUser({
        Username: username,
        Pool: userPool,
    });

const getCurrentUser = () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        // get session
        const isValidSession = cognitoUser.getSession((err, session) =>
            session.isValid()
        );
        return isValidSession ? cognitoUser : null;
    }
    // return null by default
    return null;
};

const signup = async (username, password) =>
    new Promise((resolve, reject) => {
        userPool.signUp(
            username,
            password,
            [
                new CognitoUserAttribute({
                    Name: "email",
                    Value: username,
                }),
            ],
            null,
            (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            }
        );
    });

const initiateAuth = async (cognitoUser) =>
    new Promise((resolve, reject) => {
        cognitoUser.setAuthenticationFlowType("CUSTOM_AUTH");
        cognitoUser.initiateAuth(
            new AuthenticationDetails({
                Username: cognitoUser.username,
            }),
            {
                onSuccess(result) {
                    resolve(result);
                },
                onFailure(err) {
                    reject(err);
                },
                customChallenge(challengeParameters) {
                    resolve({
                        challenge: challengeParameters,
                        cognitoUser: cognitoUser,
                    });
                },
            }
        );
    });

const answerChallenge = async (cognitoUser, code) =>
    new Promise((resolve, reject) => {
        cognitoUser.sendCustomChallengeAnswer(code, {
            onSuccess(result) {
                resolve(result);
            },
            onFailure(err) {
                reject(err);
            },
        });
    });

const logout = () => {
    const cognitoUser = getCurrentUser();
    return cognitoUser.signOut();
};

const userAttributes = () =>
    new Promise((resolve, reject) => {
        const cognitoUser = getCurrentUser();
        cognitoUser.getUserAttributes(function (err, result) {
            if (err) {
                reject(err);
            } else {
                const output = {};
                result.forEach((attr) => {
                    output[attr.Name] = attr.Value;
                });
                resolve(output);
            }
        });
    });

export default {
    setUser,
    initiateAuth,
    answerChallenge,
    logout,
    signup,
    userAttributes,
    getCurrentUser,
};
