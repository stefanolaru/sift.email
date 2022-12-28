<script>
export default {
    data() {
        return {
            email: "",
            loading: false,
        };
    },
    methods: {
        verify() {
            this.loading = true;
            this.$http
                .post(
                    "https://" + process.env.ApiDomain + "/check",
                    {
                        email: this.email,
                    },
                    {
                        headers: {
                            Authorization:
                                this.$auth.getCurrentUser().signInUserSession
                                    .accessToken.jwtToken,
                        },
                    }
                )
                .then((res) => {
                    console.log(res.data);
                    this.loading = false;
                })
                .catch((err) => {
                    console.log(err);
                    this.loading = false;
                });
        },
    },
};
</script>
<template>
    <form class="mt-6" @submit.prevent="verify">
        <input
            type="email"
            name="email"
            class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
            v-model="email"
        />
        <div class="flex items-baseline justify-between mt-6">
            <button
                type="submit"
                :disabled="loading"
                class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
                v-text="loading ? 'Please wait ...' : 'Submit'"
            ></button>
        </div>
    </form>
</template>
