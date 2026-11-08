import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert
} from "react-native";
import { colors } from "../theme/colors";
import { Header } from "../components/Header";
import { 
  getPendingSyncData, 
  getLocalCervejas, 
  getLocalEstilos, 
  getLocalFornecedores
} from "../database/sqlite";
import { syncService } from "../database/syncService";

export function SyncScreen() {
  const [networkStatus, setNetworkStatus] = useState({ isOnline: true, isSyncing: false });
  const [pending, setPending] = useState({ estilos: [], fornecedores: [], cervejas: [] });
  const [totals, setTotals] = useState({ cervejas: 0, estilos: 0, fornecedores: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarResumo();
    const unsubscribe = syncService.subscribe((status) => {
      setNetworkStatus(status);
      carregarResumo();
    });
    return unsubscribe;
  }, []);

  const carregarResumo = async () => {
    try {
      const [pendentes, c, e, f] = await Promise.all([
        getPendingSyncData(),
        getLocalCervejas(),
        getLocalEstilos(),
        getLocalFornecedores(),
      ]);
      setPending(pendentes);
      setTotals({
        cervejas: c.length,
        estilos: e.length,
        fornecedores: f.length,
      });
    } catch (err) {
      console.error("Erro ao carregar resumo de sincronização:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!networkStatus.isOnline) {
      Alert.alert("Sem conexão", "Conecte-se à internet para sincronizar os dados com o servidor.");
      return;
    }

    try {
      await syncService.syncAll(true);
      await carregarResumo();
      Alert.alert("Sucesso", "Sincronização de dados concluída com sucesso.");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível concluir a sincronização. Verifique sua conexão e tente novamente.");
    }
  };

  const totalPendentes = 
    pending.estilos.length + 
    pending.fornecedores.length + 
    pending.cervejas.length;

  return (
    <View style={styles.container}>
      <Header title="Sincronização" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* CARD DE STATUS ATUAL */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📡 Status da Conectividade</Text>
          <View style={styles.statusRow}>
            <View 
              style={[
                styles.statusPill, 
                { backgroundColor: networkStatus.isOnline ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)" }
              ]}
            >
              <Text 
                style={[
                  styles.statusPillText, 
                  { color: networkStatus.isOnline ? colors.success : colors.danger }
                ]}
              >
                {networkStatus.isOnline ? "📶 Online (Conectado ao Firestore)" : "📴 Offline (Salvo no SQLite)"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            {networkStatus.isOnline 
              ? "As operações realizadas no app são sincronizadas em tempo real com o Firebase Firestore." 
              : "Sem conexão com a internet. O SQLite local armazena os cadastros e edições com segurança até o retorno da rede."}
          </Text>

          <TouchableOpacity 
            style={[styles.syncButton, !networkStatus.isOnline && styles.syncButtonDisabled]} 
            onPress={handleManualSync}
            disabled={!networkStatus.isOnline || networkStatus.isSyncing}
          >
            {networkStatus.isSyncing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.syncButtonText}>🔄 Sincronizar Tudo Agora</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* CARD DE PENDÊNCIAS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderFlex}>
            <Text style={styles.cardTitle}>📦 Pendências de Sincronização</Text>
            <View style={[styles.badgeCount, { backgroundColor: totalPendentes > 0 ? colors.warning : colors.success }]}>
              <Text style={styles.badgeCountText}>{totalPendentes} pendentes</Text>
            </View>
          </View>

          <View style={styles.pendentesGrid}>
            <View style={styles.pendenteItem}>
              <Text style={styles.pendenteValue}>{pending.cervejas.length}</Text>
              <Text style={styles.pendenteLabel}>Cervejas</Text>
            </View>
            <View style={styles.pendenteItem}>
              <Text style={styles.pendenteValue}>{pending.estilos.length}</Text>
              <Text style={styles.pendenteLabel}>Estilos</Text>
            </View>
            <View style={styles.pendenteItem}>
              <Text style={styles.pendenteValue}>{pending.fornecedores.length}</Text>
              <Text style={styles.pendenteLabel}>Fornecedores</Text>
            </View>
          </View>
        </View>

        {/* CARD DE TOTAIS ARMAZENADOS NO SQLITE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💾 Banco de Dados Local (SQLite)</Text>
          <Text style={styles.cardDesc}>
            Registros gravados no arquivo local "cervejaria.db":
          </Text>
          <View style={styles.storageRow}>
            <Text style={styles.storageText}>🍺 Cervejas cadastradas: <Text style={styles.bold}>{totals.cervejas}</Text></Text>
            <Text style={styles.storageText}>🌾 Estilos cadastrados: <Text style={styles.bold}>{totals.estilos}</Text></Text>
            <Text style={styles.storageText}>🚚 Fornecedores cadastrados: <Text style={styles.bold}>{totals.fornecedores}</Text></Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 8,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  statusRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusPillText: {
    fontWeight: "700",
    fontSize: 13,
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  syncButtonDisabled: {
    backgroundColor: "#334155",
  },
  syncButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  cardHeaderFlex: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeCount: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeCountText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 11,
  },
  pendentesGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  pendenteItem: {
    flex: 1,
    backgroundColor: "#1c2230",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  pendenteValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "bold",
  },
  pendenteLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  storageRow: {
    gap: 6,
    marginTop: 10,
  },
  storageText: {
    color: colors.text,
    fontSize: 13,
  },
  bold: {
    color: colors.primary,
    fontWeight: "bold",
  },
});

