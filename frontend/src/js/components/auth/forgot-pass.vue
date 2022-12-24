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
    <div class="row">
        <div class="medium-4 columns medium-centered">
            <form id="login-form" @submit.prevent="submit">
                <div class="message error" v-if="errorMessage != ''">
                    {{ errorMessage }}
                </div>
                <div class="message success" v-if="successMessage != ''">
                    {{ successMessage }}
                </div>

                <h3 v-if="!sent">Forgot password</h3>
                <h3 v-else>Reset password</h3>
                <template v-if="!sent">
                    <div class="input email">
                        <input
                            type="email"
                            name="email"
                            :value="email"
                            @input="email = $event.target.value"
                            placeholder="Your Email"
                            required
                        />
                    </div>
                    <div class="submit">
                        <button
                            type="submit"
                            :disabled="loading"
                            class="button"
                            v-text="loading ? 'Please wait ...' : 'Submit'"
                        ></button>
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
                    <div class="submit">
                        <button
                            type="submit"
                            :disabled="loading"
                            class="button"
                            v-text="
                                loading ? 'Please wait ...' : 'Update Password'
                            "
                        ></button>
                    </div>
                </template>
                <router-link :to="'login'" class="forgot-pass"
                    >Login</router-link
                >
            </form>
        </div>
    </div>
</template>
