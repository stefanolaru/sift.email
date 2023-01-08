<script>
import Uploader from "./account/uploader.vue";
import Sidebar from "./account/sidebar.vue";
import RequestHistory from "./account/request-history.vue";
import FormSingle from "./account/form-single.vue";
import ListPreview from "./account/list-preview.vue";
export default {
    data() {
        return {
            profile: null,
            listSummary: null,
            csvFile: null,
        };
    },
    components: {
        Uploader,
        FormSingle,
        Sidebar,
        RequestHistory,
        ListPreview,
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
                // profile
                this.profile = res.data;
            })
            .catch((err) => {
                console.log(err);
            });
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
                console.log(res);
            })
            .catch((err) => {
                console.log(err);
            });
    },
    methods: {
        generateListPreview(csvFile, listSummary) {
            this.csvFile = csvFile;
            this.listSummary = listSummary;
        },
    },
};
</script>
<template>
    <div
        class="flex max-w-6xl mx-auto my-12 bg-white rounded-sm dark:bg-slate-700 sm:w-full"
    >
        <sidebar :profile="profile"></sidebar>
        <div class="flex-1 min-w-0 p-12">
            <template v-if="!listSummary">
                <div class="grid grid-cols-2 gap-12">
                    <div>
                        <h2 class="text-4xl font-bold">
                            Let's sift out the junk.
                        </h2>
                        <div class="mt-6">
                            <p>Check if an email address really exists.</p>
                            <form-single></form-single>
                        </div>
                    </div>
                    <uploader @processed="generateListPreview"></uploader>
                </div>
            </template>
            <list-preview
                v-else
                :summary="listSummary"
                :csv="csvFile"
            ></list-preview>
            <!--<request-history :profile="profile"></request-history>-->
        </div>
    </div>
</template>
