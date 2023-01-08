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
            dragOver: false,
        };
    },
    mounted() {
        this.mountUploader();
    },
    computed: {
        dragDropPrimaryText() {
            if (this.uploading) {
                return "Uploading";
            } else if (this.processing) {
                return "Processing";
            } else {
                return "Drag and drop your list";
            }
        },
        dragDropSecondaryText() {
            if (this.uploading || this.processing) {
                return "Please wait ...";
            }
            return "Upload your email list in <strong>CSV format</strong>";
        },
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

                    onDragOver() {
                        vm.dragOver = true;
                    },
                    onDragLeave() {
                        vm.dragOver = false;
                    },
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
                    :class="{
                        'fill-none': !dragOver,
                        'fill-slate-50 stroke-indigo-500': dragOver,
                    }"
                    class="duration-200"
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
                        class="w-32 h-32 mx-auto -mt-8 duration-200"
                        :class="{
                            'fill-gray-300': !dragOver,
                            'fill-gray-500 dark:fill-white': dragOver,
                        }"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 100 100"
                        v-if="!uploading && !processing"
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
                    <svg
                        class="w-16 h-16 mx-auto mb-3 -mt-8 duration-200 fill-gray-500 dark:fill-white"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 32 32"
                        v-if="uploading"
                    >
                        <path
                            d="M16,17.172l6.414,6.414l-2.828,2.828L18,24.828V30h-4v-5.172l-1.586,1.586l-2.828-2.828L16,17.172
	z M26,10c0-2.761-2.239-5-5-5c-0.642,0-1.251,0.132-1.815,0.352C18.076,3.354,15.947,2,13.5,2c-3.422,0-6.22,2.646-6.475,6.003
	C7.017,8.002,7.009,8,7,8c-2.761,0-5,2.239-5,5s2.239,5,5,5h6.758L16,15.758L18.242,18H26c2.209,0,4-1.791,4-4
	C30,11.791,28.209,10,26,10z"
                        />
                    </svg>
                    <svg
                        class="w-24 h-24 mx-auto mb-3 -mt-8 duration-200 fill-gray-500 dark:fill-white"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        v-if="processing"
                    >
                        <path
                            d="M14 5.714a1.474 1.474 0 0 0 0 2.572l-.502 1.684a1.473 1.473 0 0 0-1.553 2.14l-1.443 1.122A1.473 1.473 0 0 0 8.143 14l-2.304-.006a1.473 1.473 0 0 0-2.352-.765l-1.442-1.131A1.473 1.473 0 0 0 .5 9.968L0 8.278a1.474 1.474 0 0 0 0-2.555l.5-1.69a1.473 1.473 0 0 0 1.545-2.13L3.487.77A1.473 1.473 0 0 0 5.84.005L8.143 0a1.473 1.473 0 0 0 2.358.768l1.444 1.122a1.473 1.473 0 0 0 1.553 2.14L14 5.714zM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.393.061a7.976 7.976 0 0 0 .545-4.058L16.144 6a1.473 1.473 0 0 0 2.358.768l1.444 1.122a1.473 1.473 0 0 0 1.553 2.14L22 11.714a1.474 1.474 0 0 0 0 2.572l-.502 1.684a1.473 1.473 0 0 0-1.553 2.14l-1.443 1.122a1.473 1.473 0 0 0-2.359.768l-2.304-.006a1.473 1.473 0 0 0-2.352-.765l-1.442-1.131a1.473 1.473 0 0 0-1.545-2.13l-.312-1.056a7.964 7.964 0 0 0 3.821-1.674 3 3 0 1 0 2.384-3.177z"
                        />
                    </svg>
                    <div
                        class="text-2xl font-bold"
                        v-html="dragDropPrimaryText"
                    ></div>
                    <div
                        class="mt-1 text-sm text-gray-400"
                        v-html="dragDropSecondaryText"
                    ></div>
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
