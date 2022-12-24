import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: "/login",
            name: "Login",
            component: () => import("./components/auth/login.vue"),
        },
        {
            path: "/forgot-password",
            name: "Forgot Password",
            component: () => import("./components/auth/forgot-pass.vue"),
        },
        {
            path: "/logout",
            name: "Logout",
            component: () => import("./components/auth/login.vue"),
        },
    ],
});

router.beforeEach(async (to, from) => {
    // const isAuthenticated = await Auth.currentAuthenticatedUser()
    //     .then((user) => {
    //         console.log(user);
    //         return true;
    //     })
    //     .catch((err) => {
    //         console.log(err);
    //         return false;
    //     });
    const isAuthenticated = false;
    if (
        // make sure the user is authenticated
        !isAuthenticated &&
        // ❗️ Avoid an infinite redirect
        to.name !== "Login" &&
        to.name !== "Forgot Password"
    ) {
        // redirect the user to the login page
        return { name: "Login" };
    }
});

export default router;
