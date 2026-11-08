import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

// Telas
import { LoginScreen } from "../screens/LoginScreen";
import { CervejasScreen } from "../screens/CervejasScreen";
import { EstilosScreen } from "../screens/EstilosScreen";
import { FornecedoresScreen } from "../screens/FornecedoresScreen";
import { SyncScreen } from "../screens/SyncScreen";
import { ClientCatalogScreen } from "../screens/ClientCatalogScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Navegação de abas do Administrador
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#11141c",
          borderTopColor: colors.cardBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
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
        name="CatalogoCliente"
        component={ClientCatalogScreen}
        options={{
          tabBarLabel: "Catálogo",
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18 }}>🛒</Text>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Cervejaria Artesanal...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === "admin" ? (
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
