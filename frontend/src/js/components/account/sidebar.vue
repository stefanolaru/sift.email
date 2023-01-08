<script>
export default {
    props: ["profile"],
    computed: {
        accountCredits() {
            return this.profile
                ? this.profile.credits - this.profile.usage
                : "000";
        },
        profileLoading() {
            return !this.profile;
        },
    },
};
</script>
<template>
    <div
        class="flex flex-col justify-between w-48 py-12 border-r bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-800"
    >
        <div class="text-center">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-16 mx-auto mb-12"
            >
                <path
                    d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                ></path>
                <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
        </div>
        <div class="text-center">
            <div class="mb-1 text-xs tracking-wide text-gray-500 uppercase">
                Available Credits
            </div>
            <div class="text-3xl font-bold">
                <span
                    class="inline-block px-1 leading-none"
                    :class="{ 'bg-gray-200 text-gray-200': profileLoading }"
                    >{{ accountCredits }}</span
                >
            </div>
            <button
                type="submit"
                class="px-6 py-2 mt-6 text-sm font-semibold text-indigo-500 border border-indigo-500 rounded-md leading-non hover:bg-white hover:text-indigo-700"
            >
                Get Credits
            </button>
        </div>
        <div class="mt-12 text-sm leading-loose text-center text-gray-500">
            <ul>
                <li><a href="#">Settings</a></li>
                <li><a href="#">Logout</a></li>
            </ul>
        </div>
    </div>
</template>
