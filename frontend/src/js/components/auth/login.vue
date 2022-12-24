<script>
import {
    AuthenticationDetails,
    CognitoUserPool,
    CognitoUser,
} from "amazon-cognito-identity-js";

export default {
    name: "Login Form",
    data() {
        return {
            username: "",
            password: "",
            loading: false,
            errorMessage: "",
            successMessage: "",
            passChallenge: false,
            user: null,
            cognitoUser: null,
        };
    },
    mounted() {
        if (this.$route.query && this.$route.query.verified) {
            this.successMessage = "Account verified, please login.";
        }
        if (this.$route.query && this.$route.query.passupdate) {
            this.successMessage = "Password was updated, please login.";
        }
    },
    methods: {
        login() {
            this.errorMessage = "";
            this.loading = true;
            // login or pass challenge
            if (this.passChallenge) {
                // complete new password
                // console.log(this.username, this.password);
                this.cognitoUser.completeNewPasswordChallenge(
                    this.password,
                    this.user
                );
            } else {
                // sign in
                const authData = {
                    Username: this.username,
                    Password: this.password,
                };

                const authDetails = new AuthenticationDetails(authData);

                // set cognito user
                this.cognitoUser = new CognitoUser({
                    Username: authData.Username,
                    Pool: new CognitoUserPool({
                        UserPoolId: process.env.UserPoolId,
                        ClientId: process.env.UserPoolWebClientId,
                    }),
                });

                this.cognitoUser.authenticateUser(authDetails, {
                    onSuccess(result) {
                        // var accessToken = result.getAccessToken().getJwtToken();

                        console.log(result);
                    },

                    onFailure(err) {
                        console.log(err);
                        this.errorMessage = err.message;
                        this.loading = false;
                    },
                    newPasswordRequired(userAttributes) {
                        // the api doesn't accept this field back
                        delete userAttributes.email_verified;
                        //
                        this.user = userAttributes;
                        this.passChallenge = true;
                        // clear old password field
                        this.password = "";
                        // stop loading
                        this.loading = false;
                    },
                });
            }
        },
    },
};
</script>

<template>
    <div class="bg-white flex sm:w-full md:w-1/2 lg:w-1/3 mx-auto p-12">
        <form class="w-full" @submit.prevent="login">
            <div class="message error" v-if="errorMessage != ''">
                {{ errorMessage }}
            </div>

            <div class="message success" v-if="successMessage != ''">
                {{ successMessage }}
            </div>

            <h3 v-if="!passChallenge">Login</h3>
            <h3 v-else>Update Password</h3>
            <div v-if="!passChallenge">
                <label class="block font-semibold">Email</label>
                <input
                    type="email"
                    name="email"
                    class="border w-full h-5 px-3 py-5 mt-1 hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1 rounded-md"
                    :value="username"
                    @input="username = $event.target.value"
                    placeholder="Your Email"
                    required
                />
            </div>
            <div class="mt-3">
                <label class="block font-semibold">Password</label>
                <input
                    type="password"
                    name="password"
                    class="border w-full h-5 px-3 py-5 mt-1 hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1 rounded-md"
                    :value="password"
                    @input="password = $event.target.value"
                    :placeholder="passChallenge ? 'New Password' : 'Password'"
                    required
                />
            </div>
            <div class="flex justify-between items-baseline mt-6">
                <button
                    type="submit"
                    :disabled="loading"
                    class="bg-indigo-500 text-white py-3 px-12 rounded-md hover:bg-indigo-600"
                    v-text="loading ? 'Please wait ...' : 'Login'"
                ></button>
                <router-link :to="'forgot-password'" class="forgot-pass"
                    >Forgot Password?</router-link
                >
            </div>
        </form>
    </div>
</template>
