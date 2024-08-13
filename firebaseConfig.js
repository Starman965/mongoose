import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCOoX8dx7-GVlbYjNaKArUpc7hbZSm3gnw",
            authDomain: "gamenight-37cc6.firebaseapp.com",
            databaseURL: "https://gamenight-37cc6-default-rtdb.firebaseio.com",
            projectId: "gamenight-37cc6",
            storageBucket: "gamenight-37cc6.appspot.com",
            messagingSenderId: "31368693363",
            appId: "1:31368693363:web:a2c0702234977a07dbcc06"
        };

        const app = initializeApp(firebaseConfig);
        const database = getDatabase(app);
        const analytics = getAnalytics(app);

        export { database, analytics };
