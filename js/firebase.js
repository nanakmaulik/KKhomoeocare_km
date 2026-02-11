import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDBGtr942h20hiU-fljXs2N-VeSSfkodkY",
            authDomain: "kkhomoeocare-48bb2.firebaseapp.com",
            projectId: "kkhomoeocare-48bb2",
            storageBucket: "kkhomoeocare-48bb2.firebasestorage.app",
            messagingSenderId: "62076969795",
            appId: "1:62076969795:web:2255e28210303ad08385f6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);