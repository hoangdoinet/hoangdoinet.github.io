import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCY1dSogyXtxkO4dm4_5u4lurWz6-rHxX8",
  authDomain: "encypass.web.app",
  projectId: "encypass",
  storageBucket: "encypass.firebasestorage.app",
  messagingSenderId: "101205529627",
  appId: "1:101205529627:web:352dfc91b5a798515654be"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, provider };