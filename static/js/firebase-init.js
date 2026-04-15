import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDG2opZZ59kX76nY7UTs1wyayNVypQOGWM",
  authDomain:        "homebakes-9df38.firebaseapp.com",
  projectId:         "homebakes-9df38",
  storageBucket:     "homebakes-9df38.firebasestorage.app",
  messagingSenderId: "478858672548",
  appId:             "1:478858672548:web:9308ba6d3cb3ea055b2931"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
