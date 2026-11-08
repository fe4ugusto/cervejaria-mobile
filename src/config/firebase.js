import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Configuração do Firebase do projeto Cervejaria
const firebaseConfig = {
  apiKey: "AIzaSyBjFjdOD7_HS4YWAREd-Nl7A_gCoGGrZl8",
  authDomain: "cervejaria-d3215.firebaseapp.com",
  projectId: "cervejaria-d3215",
  storageBucket: "cervejaria-d3215.firebasestorage.app",
  messagingSenderId: "720329099824",
  appId: "1:720329099824:web:415b4ef132e3155634fbf5"
};

// Evita inicialização duplicada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth com persistência nativa via AsyncStorage no mobile ou browser persistence no web
let auth;
try {
  if (Platform.OS === "web") {
    auth = getAuth(app);
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (e) {
  auth = getAuth(app);
}

// Firestore Database
const db = getFirestore(app);

export { app, auth, db };
