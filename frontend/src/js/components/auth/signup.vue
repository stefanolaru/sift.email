<script>
import {
    AuthenticationDetails,
    CognitoUserPool,
    CognitoUser,
} from "amazon-cognito-identity-js";

export default {
    name: "Signup Form",
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

                let vm = this;
                this.cognitoUser.authenticateUser(authDetails, {
                    onSuccess(result) {
                        // var accessToken = result.getAccessToken().getJwtToken();

                        console.log(result);
                    },

                    onFailure(err) {
                        console.log(err);
                        vm.errorMessage = err.message;
                        vm.loading = false;
                    },
                    newPasswordRequired(userAttributes) {
                        // the api doesn't accept this field back
                        delete userAttributes.email_verified;
                        //
                        vm.user = userAttributes;
                        vm.passChallenge = true;
                        // clear old password field
                        vm.password = "";
                        // set success message
                        vm.successMessage = "Login succeeded";
                        // stop loading
                        vm.loading = false;
                    },
                });
            }
        },
    },
};
</script>

<template>
    <form class="w-full" @submit.prevent="login">
        <div
            class="p-3 mb-6 text-sm leading-none bg-red-300 rounded-sm"
            v-if="errorMessage"
        >
            {{ errorMessage }}
        </div>

        <div
            class="p-3 mb-6 text-sm leading-none bg-green-300 rounded-sm"
            v-if="successMessage"
        >
            {{ successMessage }}
        </div>

        <h3
            class="mb-3 text-3xl font-bold"
            v-text="
                passChallenge ? 'Password Update Required' : 'Create an account'
            "
        ></h3>

        <div class="mt-3" v-if="!passChallenge">
            <label class="block font-semibold">Email</label>
            <input
                type="email"
                name="email"
                class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
                :value="username"
                @input="username = $event.target.value"
                placeholder="Your Email"
                required
            />
        </div>

        <div class="flex items-baseline justify-between mt-6">
            <button
                type="submit"
                :disabled="loading"
                class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
                v-text="loading ? 'Please wait ...' : 'Create Account'"
            ></button>
        </div>
    </form>
</template>
