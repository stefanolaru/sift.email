<script>
export default {
    name: "Authentication",
    data() {
        return {
            username: "",
            tempPassword: null,
            loading: false,
            errorMessage: "",
            successMessage: "",
            confirmationCode: null,
            isCodeChallenge: null,
            isNewUser: false,
            cognitoUser: null,
        };
    },
    mounted() {
        // logout request?
        if (this.$route.name == "auth.logout") {
            // logout user
            this.$auth.logout();
            // redirect to login
            this.$router.push({ name: "auth.signup" });
        }
    },
    computed: {
        buttonText() {
            if (this.loading) {
                return "Please wait ...";
            } else {
                return "Continue";
            }
        },
    },
    methods: {
        signup() {
            this.errorMessage = "";
            this.loading = true;
            // login or pass challenge
            if (this.isCodeChallenge) {
                this.$auth
                    .answerChallenge(this.cognitoUser, this.confirmationCode)
                    .then((res) => {
                        // stop loading
                        this.loading = false;
                        // redirect to account
                        this.$router.push({
                            name: "account",
                        });
                    })
                    .catch((err) => {
                        // stop loading
                        this.loading = false;
                        // show error
                        this.errorMessage = err.message;
                    });
            } else {
                // generate random password
                this.password =
                    "P45?" +
                    Array.from(Array(24), () =>
                        Math.floor(Math.random() * 36).toString(36)
                    ).join("");

                // signup with temporary password
                this.$auth
                    .signup(this.username, this.password)
                    .then((res) => {
                        // new user flag
                        this.isNewUser = true;
                        // initiate auth
                        return this.$auth.initiateAuth(
                            this.$auth.setUser(res.user.username)
                        );
                    })
                    .catch((err) => {
                        // initiate auth on existing user
                        if (err.code == "UsernameExistsException") {
                            return this.$auth.initiateAuth(
                                this.$auth.setUser(this.username)
                            );
                        } else {
                            // pass error
                            return Promise.reject(err);
                        }
                    })
                    .then((res) => {
                        this.successMessage =
                            "We've sent you a verification code by email";
                        // stop loading
                        this.loading = false;
                        // enable code challenge
                        this.isCodeChallenge = true;
                        // set cognito user
                        this.cognitoUser = res.cognitoUser;
                    })
                    .catch((err) => {
                        // stop loading
                        this.loading = false;
                        // error message
                        this.errorMessage = err.message;
                    });
            }
        },
    },
};
</script>

<template>
    <div
        class="flex p-12 mx-auto mt-24 bg-white rounded-sm sm:w-full md:w-1/2 lg:w-1/3"
    >
        <form class="w-full" @submit.prevent="signup">
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
                v-text="cognitoUser ? 'Verify it\'s you' : 'Let\'s get started'"
            ></h3>

            <div class="mt-6" v-if="!isCodeChallenge">
                <label class="block mb-1 font-semibold text-gray-700"
                    >Your email address</label
                >
                <input
                    type="email"
                    name="email"
                    class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
                    :value="username"
                    @input="username = $event.target.value"
                    placeholder="john@example.com"
                    required
                />
            </div>

            <div v-else>
                <label for="code-field" class="block font-semibold"
                    >Enter the 6-digit code</label
                >
                <input
                    type="tel"
                    required
                    id="code-field"
                    maxlength="6"
                    class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
                    autocomplete="none"
                    v-model="confirmationCode"
                    value
                />
            </div>

            <div class="flex items-baseline justify-between mt-6">
                <button
                    type="submit"
                    :disabled="loading"
                    class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
                    v-text="buttonText"
                ></button>
            </div>
        </form>
    </div>
</template>
