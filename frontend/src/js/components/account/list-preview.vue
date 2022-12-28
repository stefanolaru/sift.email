<script>
export default {
    props: ["summary", "csv"],
    data() {
        return {
            // summary: mockdata,
            columnIdx: 0,
        };
    },
    mounted() {
        // loop all
        this.suggestColumnIdx();
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
    },
};
</script>
<template>
    <div class="w-full mt-6">
        <div class="py-3">
            Preview CSV (first 15 rows) - please make sure the email column is
            highlighted
        </div>
        <div class="h-64 overflow-scroll border border-gray-200">
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
                <tr>
                    <td
                        :colspan="summary.preview[0].length"
                        class="py-6 font-light text-center text-gray-500"
                    >
                        + {{ summary.total_rows - 16 }} rows
                    </td>
                </tr>
            </table>
        </div>
    </div>
</template>
