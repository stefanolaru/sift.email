<script>
import Uppy from "@uppy/core";
import DragDrop from "@uppy/drag-drop";
import ProgressBar from "@uppy/progress-bar";
import AwsS3Multipart from "@uppy/aws-s3-multipart";

import "@uppy/core/dist/style.css";
import "@uppy/drag-drop/dist/style.css";
import "@uppy/progress-bar/dist/style.css";

export default {
    data() {
        return {
            uppy: null,
            csvFile: null,
        };
    },
    mounted() {
        this.mountUploader();
    },
    watch: {
        csvFile() {
            this.checkCsv();
        },
    },
    methods: {
        mountUploader() {
            // stop if uppy is mounted
            if (this.uppy != null) return false;

            var vm = this;
            this.uppy = new Uppy({
                debug: true,
                autoProceed: true,
                restrictions: {
                    allowedFileTypes: [".csv"],
                    maxNumberOfFiles: 1,
                },
            });
            this.uppy
                .use(DragDrop, {
                    target: "#uploader",
                    note: "CSV files",
                })
                .use(ProgressBar, {
                    target: ".uppy-progress",
                    fixed: false,
                    // hideAfterFinish: true,
                })
                .use(AwsS3Multipart, {
                    limit: 1,
                    createMultipartUpload(file) {
                        return vm.$http
                            .post(
                                "https://" +
                                    process.env.ApiDomain +
                                    "/csv/startupload",
                                null,
                                {
                                    headers: {
                                        Authorization:
                                            vm.$auth.getCurrentUser()
                                                .signInUserSession.accessToken
                                                .jwtToken,
                                    },
                                }
                            )
                            .then((res) => res.data)
                            .catch((err) => console.log(err));
                    },
                    signPart(file, partData) {
                        return vm.$http
                            .post(
                                "https://" +
                                    process.env.ApiDomain +
                                    "/csv/sign",
                                {
                                    operation: "uploadPart",
                                    key: partData.key,
                                    uploadId: partData.uploadId,
                                    partNumbers: [partData.partNumber],
                                },
                                {
                                    headers: {
                                        Authorization:
                                            vm.$auth.getCurrentUser()
                                                .signInUserSession.accessToken
                                                .jwtToken,
                                    },
                                }
                            )
                            .then((res) => {
                                return Promise.resolve({
                                    url: res.data.presignedUrls[
                                        Object.keys(res.data.presignedUrls)[0]
                                    ],
                                });
                            })
                            .catch((err) =>
                                Promise.reject({
                                    source: { status: 500, error: err },
                                })
                            );
                    },
                    completeMultipartUpload(file, data) {
                        return vm.$http
                            .post(
                                "https://" +
                                    process.env.ApiDomain +
                                    "/csv/completeupload",
                                data,
                                {
                                    headers: {
                                        Authorization:
                                            vm.$auth.getCurrentUser()
                                                .signInUserSession.accessToken
                                                .jwtToken,
                                    },
                                }
                            )
                            .then((res) => {
                                return res.data;
                            })
                            .catch((err) => console.log(err));
                    },
                })
                .on("complete", (result) => {
                    if (result.successful) {
                        // set text to processing
                        // document.querySelector(".uppy-status-text").innerText =
                        //     "Processing ...";
                        const completedUploads = result.successful.map(
                            (item) => {
                                return {
                                    id: item.id,
                                    localFilename: item.meta.name,
                                    key: item.s3Multipart.key,
                                };
                            }
                        );
                        // populate CSV file
                        vm.csvFile = completedUploads.shift();
                        // remove the file from uploader
                        vm.uppy.removeFile(vm.csvFile.id);
                    }
                })
                .on("file-added", (file) => {
                    // this.uploading = true;
                    console.log("file added!");
                    // document.querySelector(".uppy-status-text").innerText =
                    //     "Uploading ...";
                })
                .on("upload-error", (file, err, response) => {
                    console.log(err);
                })
                .on("error", (err) => {
                    console.error(err.stack);
                });
        },
        checkCsv() {
            //
            this.$http
                .get("https://" + process.env.ApiDomain + "/csv/check", {
                    params: {
                        key: this.csvFile.key,
                    },
                    headers: {
                        Authorization:
                            this.$auth.getCurrentUser().signInUserSession
                                .accessToken.jwtToken,
                    },
                })
                .then((res) => {
                    console.log(res.data);
                })
                .catch((err) => console.log(err));
        },
    },
};
</script>
<template>
    <div>
        <div id="uploader"></div>
        <div class="uppy-progress"></div>
    </div>
</template>
