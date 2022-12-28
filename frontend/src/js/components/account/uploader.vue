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
            processing: false,
            uploading: false,
            previewInterval: 2000,
            previewRetries: 0,
            previewRetryIncrement: 1000,
            previewMaxRetries: 10,
            listSummary: null,
        };
    },
    mounted() {
        this.mountUploader();
    },
    watch: {
        csvFile() {
            // remove uploading flag
            this.uploading = false;
            // set processing flag = true
            this.processing = true;
            // delay list preview to give lambda time to process the csv
            setTimeout(() => {
                this.getListSummary();
            }, this.previewInterval);
        },
        listSummary() {
            // processing ended, summary available
            this.processing = false;
            // emit the summary
            this.$emit("processed", this.csvFile, this.listSummary);
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
                    limit: 5,
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
                        const completedUploads = result.successful.map(
                            (item) => {
                                return {
                                    id: item.id,
                                    localFilename: item.meta.name,
                                    key: item.s3Multipart.key,
                                    previewUrl: item.response.body.preview_url,
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
                    this.uploading = true;
                    console.log("file added!");
                })
                .on("upload-error", (file, err, response) => {
                    console.log(err);
                })
                .on("error", (err) => {
                    console.error(err.stack);
                });
        },
        getListSummary() {
            //
            this.$http
                .get(this.csvFile.previewUrl)
                .then((res) => {
                    this.listSummary = res.data;
                    console.log(this.listSummary);
                })
                .catch((err) => {
                    // retry again in 2 seconds if the file is not ready
                    if (this.previewRetries < this.previewMaxRetries) {
                        if (err.response && err.response.status == 403) {
                            setTimeout(() => {
                                // increment retries
                                this.previewRetries++;
                                // increment interval
                                this.previewInterval +=
                                    this.previewRetryIncrement;
                                // get list summary
                                this.getListSummary();
                            }, this.previewInterval);
                        }
                    }
                });
        },
    },
};
</script>
<template>
    <div>
        <div id="uploader"></div>
        <div class="uppy-progress"></div>
        <table v-if="listSummary">
            <tbody>
                <tr v-for="row in listSummary.preview">
                    <td v-for="col in row" v-text="col"></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
