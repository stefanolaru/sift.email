<script>
export default {
    data() {
        return {
            email: "",
        };
    },
    methods: {
        verify() {
            console.log(this.email);
        },
    },
};
</script>
<template>
    <form class="mt-6" @submit.prevent="verify">
        <input
            type="email"
            name="email"
            class="w-full h-5 px-3 py-5 mt-1 border rounded-md hover:outline-none focus:outline-none focus:ring-indigo-500 focus:ring-1"
            v-model="email"
        />
        <div class="flex items-baseline justify-between mt-6">
            <button
                type="submit"
                class="px-12 py-3 text-white bg-indigo-500 rounded-md hover:bg-indigo-600"
            >
                Submit
            </button>
        </div>
    </form>
</template>
