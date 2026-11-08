import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator 
} from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { syncService } from "../database/syncService";

export function Header({ title }) {
  const { logout } = useAuth();
  const [networkStatus, setNetworkStatus] = useState({ isOnline: true, isSyncing: false });

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status) => {
      setNetworkStatus(status);
    });
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <Text style={styles.logoIcon}>🍻</Text>
          <View>
            <Text style={styles.brandTitle}>Cervejaria Artesanal</Text>
            {title ? <Text style={styles.screenSubtitle}>{title}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Status de Conexão e Sincronização */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator}>
          <View 
            style={[
              styles.statusDot, 
              { backgroundColor: networkStatus.isOnline ? colors.success : colors.danger }
            ]} 
          />
          <Text style={styles.statusText}>
            {networkStatus.isOnline ? "Online (Firestore Conectado)" : "Offline (Gravando no SQLite)"}
          </Text>
        </View>

        {networkStatus.isOnline && (
          <TouchableOpacity 
            style={styles.syncBtn} 
            onPress={() => syncService.syncAll(true)}
            disabled={networkStatus.isSyncing}
          >
            {networkStatus.isSyncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Sincronizar</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#11141c",
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    fontSize: 28,
  },
  brandTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  logoutBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#202534",
    borderWidth: 1,
    borderColor: "#2d354a",
  },
  logoutText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  syncBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(245, 200, 66, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.3)",
  },
  syncBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
});

