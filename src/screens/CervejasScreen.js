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
  ActivityIndicator,
  ScrollView,
  Image
} from "react-native";
import { colors } from "../theme/colors";
import { Header } from "../components/Header";
import { 
  getLocalCervejas, 
  getLocalEstilos, 
  getLocalFornecedores,
  upsertLocalCerveja, 
  markLocalCervejaDeleted,
  removeLocalCervejaPermanently
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

export function CervejasScreen() {
  const [cervejas, setCervejas] = useState([]);
  const [estilos, setEstilos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Formulário
  const [nome, setNome] = useState("");
  const [estiloId, setEstiloId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [ibu, setIbu] = useState("");
  const [abv, setAbv] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

  useEffect(() => {
    carregarDados();
    const unsubscribe = syncService.subscribe(() => {
      carregarDados();
    });
    return unsubscribe;
  }, []);

  const carregarDados = async () => {
    try {
      const [listCervejas, listEstilos, listFornecedores] = await Promise.all([
        getLocalCervejas(),
        getLocalEstilos(),
        getLocalFornecedores(),
      ]);
      setCervejas(listCervejas);
      setEstilos(listEstilos);
      setFornecedores(listFornecedores);
    } catch (error) {
      console.error("Erro ao carregar dados de cervejas:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNomeEstilo = (id) => estilos.find((e) => e.id === id)?.nome || "Estilo não def.";
  const getNomeFornecedor = (id) => fornecedores.find((f) => f.id === id)?.nome || "Fornecedor não def.";

  const abrirNovo = () => {
    setEditingItem(null);
    setNome("");
    setEstiloId(estilos.length > 0 ? estilos[0].id : "");
    setFornecedorId(fornecedores.length > 0 ? fornecedores[0].id : "");
    setIbu("");
    setAbv("");
    setPreco("");
    setEstoque("");
    setImagemUrl("");
    setModalVisible(true);
  };

  const abrirEditar = (item) => {
    setEditingItem(item);
    setNome(item.nome);
    setEstiloId(item.estiloId || "");
    setFornecedorId(item.fornecedorId || "");
    setIbu(String(item.ibu || ""));
    setAbv(String(item.abv || ""));
    setPreco(String(item.preco || ""));
    setEstoque(String(item.estoque || ""));
    setImagemUrl(item.imagemUrl || "");
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert("Aviso", "O nome do produto é obrigatório.");
      return;
    }
    if (!preco || isNaN(Number(preco.replace(",", ".")))) {
      Alert.alert("Aviso", "Informe um valor numérico válido para o preço.");
      return;
    }

    const id = editingItem ? editingItem.id : "cerveja_" + Date.now();
    const isOnline = syncService.isOnline;
    const syncStatus = isOnline ? "synced" : (editingItem ? "pending_update" : "pending_create");

    const dadosCerveja = {
      id,
      nome: nome.trim(),
      estiloId,
      fornecedorId,
      ibu: Number(ibu) || 0,
      abv: Number(String(abv).replace(",", ".")) || 0,
      preco: Number(String(preco).replace(",", ".")) || 0,
      estoque: Number(estoque) || 0,
      imagemUrl: imagemUrl.trim(),
      sync_status: syncStatus,
      updatedAt: Date.now()
    };

    try {
      await upsertLocalCerveja(dadosCerveja, syncStatus);

      if (isOnline) {
        await setDoc(doc(db, "cervejas", id), {
          nome: dadosCerveja.nome,
          estiloId: dadosCerveja.estiloId,
          fornecedorId: dadosCerveja.fornecedorId,
          ibu: dadosCerveja.ibu,
          abv: dadosCerveja.abv,
          preco: dadosCerveja.preco,
          estoque: dadosCerveja.estoque,
          imagemUrl: dadosCerveja.imagemUrl,
          atualizadoEm: serverTimestamp()
        });
      }

      setModalVisible(false);
      await carregarDados();

      if (isOnline) {
        Alert.alert("Sucesso", "Produto salvo com sucesso.");
      } else {
        Alert.alert("Salvo offline", "Registro salvo localmente. A sincronização será realizada automaticamente assim que a conexão for restabelecida.");
      }
    } catch (error) {
      console.error("Erro ao salvar cerveja:", error);
      Alert.alert("Erro", "Não foi possível salvar o produto. Tente novamente.");
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
        await deleteDoc(doc(db, "cervejas", item.id));
        await removeLocalCervejaPermanently(item.id);
      } else {
        await markLocalCervejaDeleted(item.id);
      }

      await carregarDados();
      Alert.alert("Sucesso", isOnline ? "Produto excluído com sucesso." : "Registro marcado para exclusão. A atualização será concluída ao restabelecer a conexão.");
    } catch (error) {
      console.error("Erro ao excluir cerveja:", error);
      Alert.alert("Erro", "Não foi possível excluir o produto. Tente novamente.");
    }
  };

  const cervejasFiltradas = cervejas.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      getNomeEstilo(c.estiloId).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header title="Catálogo de Cervejas" />

      {/* Busca e Novo */}
      <View style={styles.actionBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar por cerveja ou estilo..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />
        <TouchableOpacity style={styles.newBtn} onPress={abrirNovo}>
          <Text style={styles.newBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Listagem */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando cervejas...</Text>
        </View>
      ) : cervejasFiltradas.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🍺</Text>
          <Text style={styles.emptyTitle}>Nenhuma cerveja cadastrada</Text>
          <Text style={styles.emptySubtitle}>Adicione um rótulo ao seu estoque.</Text>
        </View>
      ) : (
        <FlatList
          data={cervejasFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.nome}</Text>
                  <Text style={styles.cardSubtitle}>
                    🌾 {getNomeEstilo(item.estiloId)} · 🚚 {getNomeFornecedor(item.fornecedorId)}
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

              {/* BADGES TÉCNICOS: IBU, ABV, PREÇO, ESTOQUE */}
              <View style={styles.badgesRow}>
                <View style={[styles.badge, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <Text style={[styles.badgeText, { color: colors.warning }]}>
                    IBU {item.ibu || "—"}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(129, 140, 248, 0.15)" }]}>
                  <Text style={[styles.badgeText, { color: "#818cf8" }]}>
                    ABV {item.abv}%
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>
                    R$ {Number(item.preco || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    📦 {item.estoque ?? 0} un
                  </Text>
                </View>
              </View>

              {/* AÇÕES: EDITAR E EXCLUIR */}
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

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Editar Cerveja" : "Nova Cerveja"}
              </Text>

              <View style={styles.modalForm}>
                <Text style={styles.modalLabel}>Nome do Rótulo *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: IPA Tropical Hop"
                  placeholderTextColor={colors.textMuted}
                  value={nome}
                  onChangeText={setNome}
                />

                <Text style={styles.modalLabel}>Estilo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {estilos.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.chip, estiloId === e.id && styles.chipSelected]}
                      onPress={() => setEstiloId(e.id)}
                    >
                      <Text style={[styles.chipText, estiloId === e.id && styles.chipTextSelected]}>
                        {e.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.modalLabel}>Fornecedor</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {fornecedores.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.chip, fornecedorId === f.id && styles.chipSelected]}
                      onPress={() => setFornecedorId(f.id)}
                    >
                      <Text style={[styles.chipText, fornecedorId === f.id && styles.chipTextSelected]}>
                        {f.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>IBU (Amargor)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ex: 45"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={ibu}
                      onChangeText={setIbu}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>ABV (%)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ex: 6.5"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={abv}
                      onChangeText={setAbv}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Preço (R$) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ex: 19.90"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={preco}
                      onChangeText={setPreco}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Estoque (un)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ex: 50"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={estoque}
                      onChangeText={setEstoque}
                    />
                  </View>
                </View>

                <Text style={styles.modalLabel}>URL da Imagem (opcional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://exemplo.com/foto.jpg"
                  placeholderTextColor={colors.textMuted}
                  value={imagemUrl}
                  onChangeText={setImagemUrl}
                />

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
          </ScrollView>
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
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
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 12,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
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
  },
  modalScroll: {
    padding: 20,
    justifyContent: "center",
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
  chipsScroll: {
    flexDirection: "row",
    marginBottom: 6,
  },
  chip: {
    backgroundColor: "#1c2230",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#283246",
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#000",
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    gap: 10,
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

