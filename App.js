import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { getDatabase } from "./src/database/sqlite";
import { colors } from "./src/theme/colors";

export default function App() {
  useEffect(() => {
    // Inicializa o banco de dados local de forma segura
    try {
      getDatabase().catch((err) => {
        console.warn("Aviso na inicialização do SQLite:", err);
      });
    } catch (e) {
      console.warn("Aviso SQLite:", e);
    }
  }, []);

  return (
    <SafeAreaProvider style={styles.provider}>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor="#11141c" />
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    height: "100%",
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    height: "100%",
    backgroundColor: colors.background,
  },
});
