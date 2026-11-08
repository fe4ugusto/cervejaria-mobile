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
  apiKey: "AIzaSyCoKsv78Lqrfwknq_Ii0NRruqFuwIX0fmI",
  authDomain: "cervejariadb-72a98.firebaseapp.com",
  projectId: "cervejariadb-72a98",
  storageBucket: "cervejariadb-72a98.firebasestorage.app",
  messagingSenderId: "283073314822",
  appId: "1:283073314822:web:24d73eac3552adbae34387"
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
