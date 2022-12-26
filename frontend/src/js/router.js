import { createRouter, createWebHashHistory } from "vue-router";
import Auth from "./auth";

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: "/",
            name: "account",
            component: () => import("./components/account.vue"),
        },
        {
            path: "/auth",
            name: "auth",
            component: () => import("./components/auth.vue"),
        },
        {
            path: "/logout",
            name: "logout",
            component: () => import("./components/auth.vue"),
        },
    ],
});

router.beforeEach(async (to, from) => {
    const currentUser = Auth.getCurrentUser(),
        publicPathNames = ["auth"];
    // redirect to login if the user is not authenticated
    if (currentUser == null && !publicPathNames.includes(to.name)) {
        // redirect the user to the login page
        return { name: "auth" };
    }
    // redirect to account page if the user is authenticated
    if (currentUser != null && publicPathNames.includes(to.name)) {
        return { name: "account" };
    }
});

export default router;
