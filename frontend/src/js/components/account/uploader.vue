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
                    locale: {
                        strings: {
                            dropHereOr: "Drag and drop your list",
                        },
                    },
                    note: "Your email list in CSV format",
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
        <div class="relative">
            <svg
                viewBox="0 0 640 640"
                class="relative z-0 block w-full h-auto"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient
                        id="linear"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                    >
                        <stop offset="0%" stop-color="rgb(67 56 202)" />
                        <stop offset="100%" stop-color="rgb(217 70 239)" />
                    </linearGradient>
                </defs>
                <rect
                    x="2"
                    y="2"
                    width="636"
                    height="636"
                    rx="15"
                    ry="15"
                    fill="none"
                    stroke="url(#linear)"
                    stroke-width="3"
                    stroke-dasharray="12,6"
                />
            </svg>

            <div class="absolute top-0 left-0 z-10 w-full h-full">
                <div
                    class="absolute top-0 left-0 flex flex-col justify-center w-full h-full text-center"
                >
                    <svg
                        class="w-32 h-32 mx-auto -mt-8 fill-gray-300"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 100 100"
                    >
                        <path
                            d="M64.9,34.9H30.3c-2.7,0-4.8,2.2-4.8,4.8v0.8c0,0.4,0.4,0.8,0.8,0.8h32.1c2.7,0,4.8,2.2,4.8,4.8v23
	c0,0.4,0.4,0.8,0.8,0.8h0.8c2.7,0,4.8-2.2,4.8-4.8V39.7C69.7,37.1,67.5,34.9,64.9,34.9z"
                        />
                        <path
                            d="M75.3,24.6H40.7c-2.7,0-4.8,2.2-4.8,4.8v0.8c0,0.4,0.4,0.8,0.8,0.8h32.1c2.7,0,4.8,2.2,4.8,4.8v23
	c0,0.4,0.4,0.8,0.8,0.8h0.8c2.7,0,4.8-2.2,4.8-4.8V29.4C80.1,26.8,77.9,24.6,75.3,24.6z"
                        />
                        <g>
                            <path
                                d="M38.5,64.2c0.5,0.5,1.2,0.5,1.7,0l18.3-17c0.3-0.6,0.2-1.7-1.1-1.7l-36.1,0.1c-1,0-1.8,0.9-1.1,1.7
		L38.5,64.2z M58.8,53.8c0-0.8-1-1.3-1.6-0.7L42.9,66.3c-1,0.9-2.2,1.4-3.5,1.4c-1.3,0-2.5-0.5-3.5-1.3L21.7,53.1
		c-0.6-0.6-1.6-0.2-1.6,0.7C20,53.6,20,72.2,20,72.2c0,1.8,1.5,3.2,3.2,3.2h32.3c1.8,0,3.2-1.5,3.2-3.2V53.8z"
                            />
                        </g>
                    </svg>
                    <div class="text-2xl font-bold">
                        Drag and drop your list
                    </div>
                    <div class="mt-1 text-sm text-gray-400">
                        Upload your email list in <strong>CSV format</strong>
                    </div>
                </div>
                <div id="uploader" class="flex w-full h-full"></div>
                <div class="uppy-progress"></div>
            </div>
        </div>
        <table v-if="listSummary">
            <tbody>
                <tr v-for="row in listSummary.preview">
                    <td v-for="col in row" v-text="col"></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
<style>
.uppy-Root {
    width: 100%;
}
.uppy-DragDrop-container {
    border: 0;
    border-radius: 0;
    background-color: transparent;
}
.uppy-DragDrop-label {
    font-weight: bold;
}
.uppy-DragDrop-inner {
    padding: 0;
    display: none;
}
</style>
