// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import "./components/router";
import "./components/quiz";
import "./components/login";
import "@dile/ui/components/card/card.js";
import "@dile/ui/components/button/button.js";
import "@dile/ui/components/button/button-icon.js";
import "@dile/ui/components/input/input";
import { SetApp } from "./store";
import { getAuth } from "firebase/auth";

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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded");
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  await SetApp(app);

  const auth = getAuth(app);
  if (auth.currentUser !== null) {
    console.log("signed in user!");
  }

  // const analytics = getAnalytics(app);
  console.log("success");
});
