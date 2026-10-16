import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCM4P_eShZDPHXgSfrub3hlyfIo4Uf__lQ",
  authDomain: "fixiq-be.firebaseapp.com",
  projectId: "fixiq-be",
  storageBucket: "fixiq-be.firebasestorage.app",
  messagingSenderId: "1071996168518",
  appId: "1:1071996168518:web:46bf783a412c833fa41d47",
  measurementId: "G-JYD2YC6D3R"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { app, auth, analytics };
