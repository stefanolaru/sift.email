<script>
export default {
    props: ["summary", "csv"],
    data() {
        return {
            // summary: mockdata,
            columnIdx: 0,
            notifyWhenDone: true,
            agreeTerms: false,
            loading: false,
        };
    },
    mounted() {
        // loop all
        this.suggestColumnIdx();
    },
    computed: {
        buttonText() {
            return this.loading
                ? "Please wait ..."
                : "Submit " + this.listCount + " rows";
        },
        listCount() {
            return this.summary.total_rows.toLocaleString("en-US");
        },
    },
    methods: {
        suggestColumnIdx() {
            const email_regex =
                /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
            const colIdxs = [];

            this.summary.preview.forEach((row) => {
                row.forEach((col, colIdx) => {
                    // test the format with a regex
                    if (email_regex.test(col)) {
                        colIdxs.push(colIdx);
                    }
                });
            });
            // set email column index
            this.columnIdx = [...new Set(colIdxs)].shift();
        },
        submitList() {
            return this.$http
                .post(
                    "https://" + process.env.ApiDomain + "/csv/submit",
                    {
                        csv_id: this.summary.csv_id,
                        column_idx: this.columnIdx,
                        email_notification: this.notifyWhenDone,
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
                })
                .catch((err) => console.log(err));
        },
    },
};
</script>
<template>
    <form class="w-full" @submit.prevent="submitList">
        <h2 class="mb-6 text-4xl font-bold">
            Submit list for validation ({{ listCount }} rows)
        </h2>
        <div class="mb-3 text-sm">
            Here's a preview of your uploaded list (the first 15 rows) - please
            make sure the email column is highlighted before submitting.
        </div>
        <div class="h-64 mb-6 overflow-scroll border border-gray-200">
            <table class="min-w-full">
                <tr
                    v-for="(row, rowIdx) in summary.preview"
                    :class="{
                        'bg-slate-50': rowIdx % 2 == 0,
                        'bg-slate-100': !rowIdx,
                    }"
                >
                    <td
                        class="px-6 py-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap"
                        :class="{
                            'border-l-4 border-r-4 border-indigo-500 text-gray-900 font-semibold bg-indigo-50':
                                colIdx == columnIdx,
                            'border-t-4': !rowIdx && colIdx == columnIdx,
                            'border-b-4':
                                rowIdx == summary.preview.length - 1 &&
                                colIdx == columnIdx,
                        }"
                        @click="columnIdx = colIdx"
                        v-for="(col, colIdx) in row"
                        v-text="col"
                    ></td>
                </tr>
            </table>
        </div>
        <div class="mb-3">
            <label class="select-none"
                ><input type="checkbox" v-model="agreeTerms" class="mr-1" /> I
                understand the
                <u>list validation process can't be or paused or cancelled</u>,
                and I agree <strong>{{ this.listCount }} credits</strong> to be
                deducted from my account balance when this list is submitted.
            </label>
        </div>
        <div class="flex items-center justify-between">
            <div>
                <label class="leading-none select-none"
                    ><input
                        type="checkbox"
                        v-model="notifyWhenDone"
                        class="mr-1"
                    />
                    Notify me by email when the validation is finished</label
                >
            </div>
            <div>
                <button
                    type="submit"
                    :disabled="!agreeTerms || loading"
                    class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600 disabled:bg-slate-400"
                    v-text="buttonText"
                ></button>
            </div>
        </div>
    </form>
</template>
