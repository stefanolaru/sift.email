<template>
    <div
        class="flex p-12 mx-auto mt-24 bg-white rounded-sm sm:w-full md:w-1/2 lg:w-1/3"
    >
        <div>
            account
            <router-link :to="'logout'" class="">Logout</router-link>
        </div>
    </div>
</template>
<script>
export default {
    data() {
        return {
            profile: null,
        };
    },
    created() {
        this.$http
            .get("https://" + process.env.ApiDomain + "/profile", {
                params: {},
                headers: {
                    Authorization:
                        this.$auth.getCurrentUser().signInUserSession
                            .accessToken.jwtToken,
                },
            })
            .then((res) => {
                console.log(res);
            })
            .catch((err) => {
                console.log(err);
            });
    },
};
</script>
