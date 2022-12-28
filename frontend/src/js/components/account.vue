<script>
import Uploader from "./account/uploader.vue";
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
    <div class="max-w-6xl p-12 mx-auto mt-24 bg-white rounded-sm sm:w-full">
        <template v-if="!listSummary">
            <div class="grid grid-cols-2 gap-12">
                <div>
                    <h2 class="mb-3 text-4xl font-bold">
                        Remove invalid emails from your list
                    </h2>
                    <p>Check if an email address really exists.</p>
                    <form-single></form-single>
                </div>
                <uploader @processed="generateListPreview"></uploader>
            </div>
        </template>
        <list-preview></list-preview>
    </div>
</template>
