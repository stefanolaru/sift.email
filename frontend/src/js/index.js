import { createApp } from "vue";
import Auth from "./auth";
import axios from "axios";
import Swal from "sweetalert2";

// import routes
import router from "./router";

const app = createApp({
    name: "sift.email",
    data() {
        return {};
    },
    computed: {
        isAuthenticated() {
            return this.$auth.getCurrentUser() != null;
        },
    },
    created() {
        // check if user is authenticated
        // this.getCurrentUser();
    },
});

app.config.globalProperties.$auth = Auth;
app.config.globalProperties.$http = axios;
app.config.globalProperties.$swal = Swal;
app.use(router);
app.mount("#app");

// import css
import "../css/style.css";
