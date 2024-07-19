// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import "./components/router";
import "./components/quiz";
import "./components/quizzer";
import "./components/login";
import "./components/view";
import "./components/new";
import "./components/pinyin_selector";
import "./components/review";
import "@dile/ui/components/card/card.js";
import "@dile/ui/components/button/button.js";
import "@dile/ui/components/button/button-icon.js";
import "@dile/ui/components/input/input";
import "@dile/ui/components/pages/pages.js";
import "@dile/ui/components/tabs/tabs.js";
import "@dile/ui/components/modal/modal";
import "@dile/ui/components/toast/toast";
import "@dile/ui/components/rating/rating.js";
import "@dile/ui/components/spinner/spinner.js";
import "@dile/ui/components/modal/modal-help";
import "@doubletrade/lit-datatable/lit-datatable";
import "@doubletrade/lit-datatable/lit-datatable-column";
import { SetApp } from "./store";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCdf3S2HDEw3Vq4XqxU-5CsEx5jbtveUm0",
  authDomain: "hanziwriter-35e9a.firebaseapp.com",
  projectId: "hanziwriter-35e9a",
  storageBucket: "hanziwriter-35e9a.appspot.com",
  messagingSenderId: "77786650624",
  appId: "1:77786650624:web:8b3ab6a98332316453e0e5",
  measurementId: "G-BMN2W33RJG"
};

// Initialize Firebase
const startFirestore = async () => {
  const app = initializeApp(firebaseConfig);
  initializeFirestore(app, {
    localCache: persistentLocalCache(/*settings*/ {})
  });
  await SetApp(app);
};
document.addEventListener("DOMContentLoaded", async () => {
  await startFirestore();
});

const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/"
      });
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.waiting) {
        console.log("Service worker installed");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};

// …

registerServiceWorker();
