import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: "/auth",
            name: "Auth",
            component: () => import("./views/auth.vue"),
            children: [
                {
                    path: "",
                    name: "auth.login",
                    component: () => import("./components/auth/login.vue"),
                },
                {
                    path: "signup",
                    name: "auth.signup",
                    component: () => import("./components/auth/signup.vue"),
                },
                {
                    path: "forgot-password",
                    name: "auth.forgot-password",
                    component: () =>
                        import("./components/auth/forgot-pass.vue"),
                },
            ],
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
        to.name !== "auth.signup" &&
        to.name !== "auth.login" &&
        to.name !== "auth.forgot-password"
    ) {
        // redirect the user to the login page
        return { name: "auth.login" };
    }
});

export default router;
