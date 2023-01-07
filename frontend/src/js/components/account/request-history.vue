<script>
export default {
    props: ["profile"],
    data() {
        return {
            requests: [],
        };
    },
    mounted() {
        this.$http
            .get("https://" + process.env.ApiDomain + "/requests", {
                params: {},
                headers: {
                    Authorization:
                        this.$auth.getCurrentUser().signInUserSession
                            .accessToken.jwtToken,
                },
            })
            .then((res) => {
                this.requests = res.data;
            })
            .catch((err) => {
                console.log(err);
            });
    },
};
</script>
<template>
    <div>
        <div>History</div>
        <div v-for="item in requests">
            <div class="text-sm font-semibold">
                Request ID: {{ item.SK.replace("request#", "") }}
            </div>
        </div>
    </div>
</template>
