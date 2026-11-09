import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { auth } from "../config/firebase";
import { Platform } from "react-native";

const AuthContext = createContext({});

const STORAGE_USER_KEY = "@cervejaria_user";
const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega usuário salvo localmente ao abrir o app
  useEffect(() => {
    async function loadStoredUser() {
      try {
        const storedUser = await AsyncStorage.getItem(STORAGE_USER_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Erro ao carregar usuário salvo:", e);
      } finally {
        setLoading(false);
      }
    }
    loadStoredUser();
  }, []);

  const login = async (email, password) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Credenciais padrão do sistema: Administrador Geral
      if (cleanEmail === "admin@cervejaria.com" && password === "1234") {
        const u = { email: cleanEmail, role: "admin", name: "Administrador Geral" };
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
        setUser(u);
        return { success: true };
      }

      // Credenciais padrão do sistema: Administrador Felipe
      if ((cleanEmail === "felipe@gmail.com" || cleanEmail === "felipe@cervejaria.com") && (password === "1234" || password === "123456")) {
        const u = { email: cleanEmail, role: "admin", name: "Felipe Administrador" };
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
        setUser(u);
        return { success: true };
      }

      // Credenciais padrão do sistema: Cliente Cervejeiro
      if (cleanEmail === "cliente@cervejaria.com" && password === "1234") {
        const u = { email: cleanEmail, role: "cliente", name: "Cliente Cervejeiro" };
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
        setUser(u);
        return { success: true };
      }

      // Autenticação via Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userEmail = (userCredential.user.email || "").toLowerCase();
      const isAdmin = 
        userEmail === "admin@cervejaria.com" || 
        userEmail === "felipe@gmail.com" || 
        userEmail === "felipe@cervejaria.com";

      const u = {
        uid: userCredential.user.uid,
        email: userEmail,
        name: userCredential.user.displayName || (isAdmin ? "Felipe Administrador" : userEmail.split("@")[0]),
        role: isAdmin ? "admin" : "cliente",
      };

      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
      setUser(u);
      return { success: true };
    } catch (error) {
      console.error("Erro no login:", error);
      let message = "Falha ao realizar login. Verifique seus dados.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        message = "E-mail ou senha incorretos.";
      } else if (error.code === "auth/user-not-found") {
        message = "Usuário não cadastrado.";
      } else if (error.code === "auth/invalid-email") {
        message = "Formato de e-mail inválido.";
      }
      return { success: false, error: message };
    }
  };

  const signup = async (email, password, name) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      const u = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: name || cleanEmail.split("@")[0],
        role: "cliente",
      };

      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
      setUser(u);
      return { success: true };
    } catch (error) {
      console.error("Erro no cadastro:", error);
      let message = "Não foi possível criar a conta.";
      if (error.code === "auth/email-already-in-use") {
        message = "Este e-mail já está em uso.";
      } else if (error.code === "auth/weak-password") {
        message = "A senha deve ter no mínimo 6 caracteres.";
      }
      return { success: false, error: message };
    }
  };

  // Autenticação com Google (SEMPRE entra como Cliente)
  const loginWithGoogle = async () => {
    try {
      if (Platform.OS === "web") {
        const result = await signInWithPopup(auth, googleProvider);
        const userEmail = (result.user.email || "").toLowerCase();

        const u = {
          uid: result.user.uid,
          email: userEmail,
          name: result.user.displayName || userEmail.split("@")[0],
          role: "cliente",
          photoURL: result.user.photoURL || "https://lh3.googleusercontent.com/a/default-user",
          provider: "google.com",
        };

        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
        setUser(u);
        return { success: true, user: u };
      } else {
        // Fallback mobile: entra como Cliente
        const demoGoogleUser = {
          uid: "google_cliente",
          email: "usuario.google@cervejaria.com",
          name: "Usuário Google",
          role: "cliente",
          photoURL: "https://lh3.googleusercontent.com/a/default-user",
          provider: "google.com"
        };
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demoGoogleUser));
        setUser(demoGoogleUser);
        return { success: true, user: demoGoogleUser };
      }
    } catch (error) {
      console.error("Erro no login com Google:", error);
      return { success: false, error: "Falha na autenticação com o Google." };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // Ignora erro se estiver offline
    }
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
  };

  // Alterna perfil do usuário
  const toggleRole = () => {
    if (!user) return;
    const newRole = user.role === "admin" ? "cliente" : "admin";
    const updated = { ...user, role: newRole };
    AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout, toggleRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
