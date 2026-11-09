import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

// Telas
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { CervejasScreen } from "../screens/CervejasScreen";
import { EstilosScreen } from "../screens/EstilosScreen";
import { FornecedoresScreen } from "../screens/FornecedoresScreen";
import { RelatorioScreen } from "../screens/RelatorioScreen";
import { SyncScreen } from "../screens/SyncScreen";
import { ClientCatalogScreen } from "../screens/ClientCatalogScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Navegação de abas do Administrador (sem catálogo de compras)
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d1017",
          borderTopColor: "rgba(245, 200, 66, 0.15)",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Cervejas"
        component={CervejasScreen}
        options={{
          tabBarLabel: "Cervejas",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>🍺</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Estilos"
        component={EstilosScreen}
        options={{
          tabBarLabel: "Estilos",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>🌾</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Fornecedores"
        component={FornecedoresScreen}
        options={{
          tabBarLabel: "Fornecedores",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>🚚</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Relatorios"
        component={RelatorioScreen}
        options={{
          tabBarLabel: "Relatórios",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>📊</Text>
          ),
        }}
      />

      <Tab.Screen
        name="Sincronizacao"
        component={SyncScreen}
        options={{
          tabBarLabel: "Sincronização",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>🔄</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  // Começa sempre na tela inicial (WelcomeScreen) ao abrir o app
  const [hasEntered, setHasEntered] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Cervejaria Artesanal...</Text>
      </View>
    );
  }

  // Enquanto o usuário estiver na tela de boas-vindas inicial ou fazendo login
  if (!hasEntered || !user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="Welcome">
            {(props) => (
              <WelcomeScreen
                {...props}
                onEnter={() => setHasEntered(true)}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
                onLoginSuccess={() => setHasEntered(true)}
                onBack={() => setHasEntered(false)}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Usuário autenticado que já clicou para acessar a plataforma
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {user.role === "admin" ? (
          <Stack.Screen name="AdminDashboard" component={AdminTabs} />
        ) : (
          <Stack.Screen name="ClientHome" component={ClientCatalogScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
});
