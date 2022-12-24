<script>
export default {
    name: "Forgot Password",
    data() {
        return {
            email: "",
            password: "",
            code: "",
            loading: false,
            errorMessage: "",
            successMessage: "",
        };
    },
    methods: {
        submit: function () {
            var vm = this;
            // clear error
            this.errorMessage = "";
            this.successMessage = "";
            // set loading state
            this.loading = true;

            if (!this.sent) {
                Auth.forgotPassword(this.email)
                    .then((data) => {
                        this.successMessage =
                            "Verification code sent via email.";
                        this.loading = false;
                        this.sent = true;
                    })
                    .catch((err) => {
                        this.errorMessage = err.message;
                        this.loading = false;
                    });
            } else {
                // Collect confirmation code and new password, then
                Auth.forgotPasswordSubmit(this.email, this.code, this.password)
                    .then((data) => {
                        this.$router.push("/login?passupdate=1");
                    })
                    .catch((err) => {
                        this.errorMessage = err.message;
                        this.loading = false;
                    });
            }
        },
    },
};
</script>

<template>
    <form class="w-full" @submit.prevent="submit">
        <div
            class="p-3 mb-6 text-sm leading-none bg-red-300 rounded-sm"
            v-if="errorMessage != ''"
        >
            {{ errorMessage }}
        </div>
        <div
            class="p-3 mb-6 text-sm leading-none bg-green-300 rounded-sm"
            v-if="successMessage != ''"
        >
            {{ successMessage }}
        </div>

        <h3
            class="mb-3 text-3xl font-bold"
            v-text="!sent ? 'Forgot Password' : 'Reset Password'"
        ></h3>
        <template v-if="!sent">
            <div class="input email">
                <input
                    class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
                    type="email"
                    name="email"
                    :value="email"
                    @input="email = $event.target.value"
                    placeholder="Your Email"
                    required
                />
            </div>
            <div class="flex items-baseline justify-between mt-6">
                <button
                    type="submit"
                    :disabled="loading"
                    class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
                    v-text="loading ? 'Please wait ...' : 'Submit'"
                ></button>
                <router-link :to="'auth/login'" class="forgot-pass"
                    >Login</router-link
                >
            </div>
        </template>
        <template v-else>
            <div class="input number">
                <input
                    type="tel"
                    name="code"
                    required
                    id="code-field"
                    maxlength="6"
                    autocomplete="none"
                    :value="code"
                    @input="code = $event.target.value"
                    placeholder="Confirmation Code"
                />
            </div>
            <div class="input password">
                <input
                    type="password"
                    name="password"
                    :value="password"
                    @input="password = $event.target.value"
                    placeholder="New Password"
                    required
                />
            </div>
            <div class="flex items-baseline justify-between mt-6">
                <button
                    type="submit"
                    :disabled="loading"
                    class="button"
                    v-text="loading ? 'Please wait ...' : 'Update Password'"
                ></button>
                <router-link :to="'auth/login'" class="forgot-pass"
                    >Login</router-link
                >
            </div>
        </template>
    </form>
</template>
