import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Platform,
  StatusBar
} from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { syncService } from "../database/syncService";

export function Header({ title }) {
  const { user, logout } = useAuth();
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
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText} numberOfLines={1}>
              {user?.role === "admin" ? "🛡️ Admin" : "👤 " + (user?.name || "Cliente")}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
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
            onPress={() => syncService.syncAll()}
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
    backgroundColor: "#0d1017",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 12) + 8 : 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 200, 66, 0.12)",
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
    fontSize: 26,
    backgroundColor: "rgba(245, 200, 66, 0.1)",
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.25)",
  },
  brandTitle: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
    fontWeight: "500",
  },
  userBadge: {
    backgroundColor: "rgba(245, 200, 66, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.3)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  userBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  logoutText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(245, 200, 66, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.35)",
  },
  syncBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
});

