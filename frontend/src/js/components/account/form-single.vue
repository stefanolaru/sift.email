<script>
export default {
    data() {
        return {
            email: "",
            submitted: "",
            loading: false,
            result: null,
        };
    },
    computed: {
        resultText() {
            let output = [];
            if (
                this.result.result == "VALID" &&
                this.result.accuracy != "HIGH"
            ) {
                output.push("LIKELY");
            }
            output.push(this.result.result);
            return output.join(" ");
        },
    },
    methods: {
        verify() {
            // pass email to submitted
            this.submitted = this.email;
            // clean up previous result
            this.result = null;
            // clean email form
            this.email = "";
            // loading flag
            this.loading = true;
            // request
            this.$http
                .post(
                    "https://" + process.env.ApiDomain + "/check/private",
                    {
                        email: this.submitted,
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
                    this.result = res.data;
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
    <div class="mt-6">
        <form class="flex space-x-3" @submit.prevent="verify">
            <input
                type="email"
                name="email"
                class="w-full h-5 px-3 py-6 leading-none border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
                v-model="email"
            />
            <div class="flex items-baseline justify-between">
                <button
                    type="submit"
                    class="px-6 py-3 text-white bg-indigo-500 rounded-md leading-non hover:bg-indigo-600"
                >
                    Check
                </button>
            </div>
        </form>
        <div
            class="p-6 mt-6 leading-none rounded-md"
            v-if="submitted"
            :class="{
                'border-teal-500 border-2': result && result.result == 'VALID',
                'border-amber-500 border-2':
                    result &&
                    result.result == 'VALID' &&
                    result.accuracy != 'HIGH',
                'border-red-500 border-2': result && result.result == 'INVALID',
                'bg-slate-50': !result,
                'bg-white': result,
            }"
        >
            <div
                class="text-xl font-semibold text-center"
                v-text="submitted"
            ></div>
            <div v-if="result" class="text-center">
                <div
                    class="my-3 text-3xl font-bold tracking-wide"
                    :class="{
                        'text-teal-500': result && result.result == 'VALID',
                        'text-amber-500':
                            result &&
                            result.result == 'VALID' &&
                            result.accuracy != 'HIGH',
                        'text-orange-600': result && result.result == 'INVALID',
                    }"
                    v-text="resultText"
                ></div>
                <div class="text-sm">
                    Accuracy:
                    <span
                        class="font-bold tracking-wide"
                        v-text="result.accuracy"
                    ></span
                    ><span
                        v-if="result && result.note"
                        v-text="' - ' + result.note"
                    ></span>
                </div>
            </div>
            <div v-else>
                <svg
                    class="w-16 mx-auto my-6 text-indigo-500"
                    viewBox="0 0 120 30"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                >
                    <circle cx="15" cy="15" r="15">
                        <animate
                            attributeName="r"
                            from="15"
                            to="15"
                            begin="0s"
                            dur="0.8s"
                            values="15;9;15"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="fill-opacity"
                            from="1"
                            to="1"
                            begin="0s"
                            dur="0.8s"
                            values="1;.5;1"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle cx="60" cy="15" r="9" fill-opacity="0.3">
                        <animate
                            attributeName="r"
                            from="9"
                            to="9"
                            begin="0s"
                            dur="0.8s"
                            values="9;15;9"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="fill-opacity"
                            from="0.5"
                            to="0.5"
                            begin="0s"
                            dur="0.8s"
                            values=".5;1;.5"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle cx="105" cy="15" r="15">
                        <animate
                            attributeName="r"
                            from="15"
                            to="15"
                            begin="0s"
                            dur="0.8s"
                            values="15;9;15"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="fill-opacity"
                            from="1"
                            to="1"
                            begin="0s"
                            dur="0.8s"
                            values="1;.5;1"
                            calcMode="linear"
                            repeatCount="indefinite"
                        />
                    </circle>
                </svg>
            </div>
        </div>
    </div>
</template>
