import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator
} from "react-native";
import { colors } from "../theme/colors";
import { Header } from "../components/Header";
import { 
  getLocalEstilos, 
  upsertLocalEstilo, 
  markLocalEstiloDeleted,
  removeLocalEstiloPermanently
} from "../database/sqlite";
import { syncService } from "../database/syncService";
import { db } from "../config/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

const AMARGOR_OPCOES = ["Baixo", "Médio", "Alto", "Muito Alto"];

export function EstilosScreen() {
  const [estilos, setEstilos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [amargor, setAmargor] = useState("Médio");

  useEffect(() => {
    carregarDados();
    const unsubscribe = syncService.subscribe(() => {
      carregarDados();
    });
    return unsubscribe;
  }, []);

  const carregarDados = async () => {
    try {
      const locais = await getLocalEstilos();
      setEstilos(locais);
    } catch (error) {
      console.error("Erro ao carregar estilos:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirNovo = () => {
    setEditingItem(null);
    setNome("");
    setOrigem("");
    setAmargor("Médio");
    setModalVisible(true);
  };

  const abrirEditar = (item) => {
    setEditingItem(item);
    setNome(item.nome);
    setOrigem(item.origem || "");
    setAmargor(item.amargor || "Médio");
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert("Aviso", "O nome do estilo é obrigatório.");
      return;
    }

    const id = editingItem ? editingItem.id : "estilo_" + Date.now();
    const isOnline = syncService.isOnline;
    const syncStatus = isOnline ? "synced" : (editingItem ? "pending_update" : "pending_create");

    const dadosEstilo = {
      id,
      nome: nome.trim(),
      origem: origem.trim(),
      amargor,
      sync_status: syncStatus,
      updatedAt: Date.now()
    };

    try {
      await upsertLocalEstilo(dadosEstilo, syncStatus);

      if (isOnline) {
        await setDoc(doc(db, "estilos", id), {
          nome: dadosEstilo.nome,
          origem: dadosEstilo.origem,
          amargor: dadosEstilo.amargor,
          atualizadoEm: serverTimestamp()
        });
      }

      setModalVisible(false);
      await carregarDados();

      if (isOnline) {
        Alert.alert("Sucesso", "Estilo salvo com sucesso.");
      } else {
        Alert.alert("Salvo offline", "Registro salvo localmente. A sincronização será realizada automaticamente assim que a conexão for restabelecida.");
      }
    } catch (error) {
      console.error("Erro ao salvar estilo:", error);
      Alert.alert("Erro", "Não foi possível salvar o estilo. Tente novamente.");
    }
  };

  const confirmarExcluir = (item) => {
    Alert.alert(
      "Confirmar exclusão",
      `Tem certeza de que deseja excluir "${item.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive", 
          onPress: () => executarExclusao(item) 
        }
      ]
    );
  };

  const executarExclusao = async (item) => {
    const isOnline = syncService.isOnline;

    try {
      if (isOnline) {
        await deleteDoc(doc(db, "estilos", item.id));
        await removeLocalEstiloPermanently(item.id);
      } else {
        await markLocalEstiloDeleted(item.id);
      }

      await carregarDados();
      Alert.alert("Sucesso", isOnline ? "Estilo excluído com sucesso." : "Registro marcado para exclusão. A atualização será concluída ao restabelecer a conexão.");
    } catch (error) {
      console.error("Erro ao excluir estilo:", error);
      Alert.alert("Erro", "Não foi possível excluir o estilo. Tente novamente.");
    }
  };

  const estilosFiltrados = estilos.filter(
    (e) =>
      e.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (e.origem && e.origem.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <Header title="Estilos de Cerveja" />

      {/* Busca e Novo */}
      <View style={styles.actionBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar estilo ou país..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />
        <TouchableOpacity style={styles.newBtn} onPress={abrirNovo}>
          <Text style={styles.newBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA DE ESTILOS (READ) */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando estilos do SQLite...</Text>
        </View>
      ) : estilosFiltrados.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🌾</Text>
          <Text style={styles.emptyTitle}>Nenhum estilo encontrado</Text>
          <Text style={styles.emptySubtitle}>Cadastre um novo estilo para começar.</Text>
        </View>
      ) : (
        <FlatList
          data={estilosFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.nome}</Text>
                  <Text style={styles.cardSubtitle}>
                    🌍 {item.origem ? item.origem : "Origem não informada"}
                  </Text>
                </View>

                {/* Badge de Sincronização */}
                <View 
                  style={[
                    styles.syncBadge, 
                    { 
                      backgroundColor: item.sync_status === "synced" 
                        ? "rgba(34, 197, 94, 0.15)" 
                        : "rgba(245, 158, 11, 0.15)" 
                    }
                  ]}
                >
                  <Text 
                    style={[
                      styles.syncBadgeText, 
                      { 
                        color: item.sync_status === "synced" 
                          ? colors.success 
                          : colors.warning 
                      }
                    ]}
                  >
                    {item.sync_status === "synced" ? "☁️ Nuvem" : "⏳ SQLite"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Amargor: {item.amargor}</Text>
                </View>
              </View>

              {/* BOTÕES DE AÇÃO: UPDATE E DELETE */}
              <View style={styles.cardActions}>
                <TouchableOpacity 
                  style={styles.actionBtnEdit} 
                  onPress={() => abrirEditar(item)}
                >
                  <Text style={styles.actionBtnEditText}>✏️ Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtnDelete} 
                  onPress={() => confirmarExcluir(item)}
                >
                  <Text style={styles.actionBtnDeleteText}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO (CREATE / UPDATE) */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? "Editar Estilo" : "Novo Estilo"}
            </Text>

            <View style={styles.modalForm}>
              <Text style={styles.modalLabel}>Nome do Estilo *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: India Pale Ale (IPA)"
                placeholderTextColor={colors.textMuted}
                value={nome}
                onChangeText={setNome}
              />

              <Text style={styles.modalLabel}>País de Origem</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Inglaterra, Alemanha, Bélgica"
                placeholderTextColor={colors.textMuted}
                value={origem}
                onChangeText={setOrigem}
              />

              <Text style={styles.modalLabel}>Nível de Amargor</Text>
              <View style={styles.amargorSelector}>
                {AMARGOR_OPCOES.map((opcao) => (
                  <TouchableOpacity
                    key={opcao}
                    style={[
                      styles.amargorOption,
                      amargor === opcao && styles.amargorOptionSelected
                    ]}
                    onPress={() => setAmargor(opcao)}
                  >
                    <Text
                      style={[
                        styles.amargorOptionText,
                        amargor === opcao && styles.amargorOptionTextSelected
                      ]}
                    >
                      {opcao}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={salvar}>
                  <Text style={styles.saveBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionBar: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  newBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 10,
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: "#131722",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  syncBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 14,
  },
  tag: {
    backgroundColor: "#1f2433",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tagText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "500",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  actionBtnEdit: {
    flex: 1,
    backgroundColor: "#202636",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnEditText: {
    color: colors.info,
    fontWeight: "600",
    fontSize: 13,
  },
  actionBtnDelete: {
    flex: 1,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnDeleteText: {
    color: colors.danger,
    fontWeight: "600",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  modalForm: {
    gap: 12,
  },
  modalLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  amargorSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  amargorOption: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#1b202c",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#293245",
  },
  amargorOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  amargorOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  amargorOptionTextSelected: {
    color: "#000",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#202636",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#000",
    fontWeight: "bold",
  },
});

