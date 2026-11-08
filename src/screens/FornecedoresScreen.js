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
  Switch,
  ScrollView
} from "react-native";
import { colors } from "../theme/colors";
import { Header } from "../components/Header";
import { 
  getLocalFornecedores, 
  upsertLocalFornecedor, 
  markLocalFornecedorDeleted,
  removeLocalFornecedorPermanently
} from "../database/sqlite";
import { syncService } from "../database/syncService";
import { consultarCep } from "../services/cepApi";
import { db } from "../config/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

export function FornecedoresScreen() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    carregarDados();
    const unsubscribe = syncService.subscribe(() => {
      carregarDados();
    });
    return unsubscribe;
  }, []);

  const carregarDados = async () => {
    try {
      const locais = await getLocalFornecedores();
      setFornecedores(locais);
    } catch (error) {
      console.error("Erro ao carregar fornecedores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarCep = async () => {
    if (!cep.trim()) {
      Alert.alert("Aviso", "Digite um CEP para consultar.");
      return;
    }

    setBuscandoCep(true);
    try {
      const dados = await consultarCep(cep);
      if (dados) {
        setLogradouro(dados.logradouro);
        setBairro(dados.bairro);
        setCidade(dados.cidade);
        setUf(dados.uf);
        Alert.alert("Sucesso", `Endereço localizado:\n${dados.cidade} - ${dados.uf}`);
      }
    } catch (error) {
      Alert.alert("Erro na Consulta do CEP", error.message || "Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const abrirNovo = () => {
    setEditingItem(null);
    setNome("");
    setContato("");
    setCep("");
    setLogradouro("");
    setBairro("");
    setCidade("");
    setUf("");
    setAtivo(true);
    setModalVisible(true);
  };

  const abrirEditar = (item) => {
    setEditingItem(item);
    setNome(item.nome);
    setContato(item.contato || "");
    setCep(item.cep || "");
    setLogradouro(item.logradouro || "");
    setBairro(item.bairro || "");
    setCidade(item.cidade || "");
    setUf(item.uf || "");
    setAtivo(item.ativo !== false);
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert("Atenção", "O nome do fornecedor é obrigatório.");
      return;
    }

    const id = editingItem ? editingItem.id : "forn_" + Date.now();
    const isOnline = syncService.isOnline;
    const syncStatus = isOnline ? "synced" : (editingItem ? "pending_update" : "pending_create");

    const dadosFornecedor = {
      id,
      nome: nome.trim(),
      contato: contato.trim(),
      cep: cep.trim(),
      logradouro: logradouro.trim(),
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim().toUpperCase(),
      ativo,
      sync_status: syncStatus,
      updatedAt: Date.now()
    };

    try {
      await upsertLocalFornecedor(dadosFornecedor, syncStatus);

      if (isOnline) {
        await setDoc(doc(db, "fornecedores", id), {
          nome: dadosFornecedor.nome,
          contato: dadosFornecedor.contato,
          cep: dadosFornecedor.cep,
          logradouro: dadosFornecedor.logradouro,
          bairro: dadosFornecedor.bairro,
          cidade: dadosFornecedor.cidade,
          uf: dadosFornecedor.uf,
          ativo: dadosFornecedor.ativo,
          atualizadoEm: serverTimestamp()
        });
      }

      setModalVisible(false);
      await carregarDados();

      if (isOnline) {
        Alert.alert("Sucesso", "Fornecedor salvo e sincronizado na nuvem!");
      } else {
        Alert.alert("Salvo Localmente", "Você está offline. O fornecedor foi salvo no SQLite e será sincronizado quando a internet retornar.");
      }
    } catch (error) {
      console.error("Erro ao salvar fornecedor:", error);
      Alert.alert("Erro", "Não foi possível salvar o fornecedor.");
    }
  };

  const confirmarExcluir = (item) => {
    Alert.alert(
      "Excluir Fornecedor",
      `Deseja realmente excluir "${item.nome}"?`,
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
        await deleteDoc(doc(db, "fornecedores", item.id));
        await removeLocalFornecedorPermanently(item.id);
      } else {
        await markLocalFornecedorDeleted(item.id);
      }

      await carregarDados();
      Alert.alert("Excluído", isOnline ? "Fornecedor removido com sucesso." : "Removido localmente. A exclusão será sincronizada com a nuvem ao reconectar.");
    } catch (error) {
      console.error("Erro ao excluir fornecedor:", error);
      Alert.alert("Erro", "Falha ao excluir fornecedor.");
    }
  };

  const fornecedoresFiltrados = fornecedores.filter(
    (f) =>
      f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (f.cidade && f.cidade.toLowerCase().includes(busca.toLowerCase())) ||
      (f.contato && f.contato.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <Header title="Fornecedores" />

      {/* Busca e Novo */}
      <View style={styles.actionBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar fornecedor ou cidade..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />
        <TouchableOpacity style={styles.newBtn} onPress={abrirNovo}>
          <Text style={styles.newBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* LISTAGEM DE FORNECEDORES (READ) */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando fornecedores do SQLite...</Text>
        </View>
      ) : fornecedoresFiltrados.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🚚</Text>
          <Text style={styles.emptyTitle}>Nenhum fornecedor encontrado</Text>
          <Text style={styles.emptySubtitle}>Cadastre um parceiro ou fornecedor de insumos.</Text>
        </View>
      ) : (
        <FlatList
          data={fornecedoresFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.nome}</Text>
                  <Text style={styles.cardSubtitle}>
                    ✉️ {item.contato || "Sem contato informado"}
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

              <View style={styles.locationBox}>
                <Text style={styles.locationText}>
                  📍 {item.cidade ? `${item.cidade}${item.uf ? " - " + item.uf : ""}` : "Localização não cadastrada"}
                  {item.cep ? ` (CEP: ${item.cep})` : ""}
                </Text>
                {item.logradouro ? (
                  <Text style={styles.streetText}>{item.logradouro}, {item.bairro}</Text>
                ) : null}
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusTag, { backgroundColor: item.ativo ? "rgba(34, 197, 94, 0.1)" : "rgba(148, 163, 184, 0.1)" }]}>
                  <Text style={[styles.statusTagText, { color: item.ativo ? colors.success : colors.textMuted }]}>
                    ● {item.ativo ? "Fornecedor Ativo" : "Inativo"}
                  </Text>
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

      {/* MODAL DE CADASTRO / EDIÇÃO (CREATE / UPDATE + API VIACEP) */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Editar Fornecedor" : "Novo Fornecedor"}
              </Text>

              <View style={styles.modalForm}>
                <Text style={styles.modalLabel}>Nome da Empresa / Fornecedor *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: Hops & Malte Brasil"
                  placeholderTextColor={colors.textMuted}
                  value={nome}
                  onChangeText={setNome}
                />

                <Text style={styles.modalLabel}>Contato / E-mail</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: vendas@empresa.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={contato}
                  onChangeText={setContato}
                />

                {/* CAMPO DE CEP COM INTEGRAÇÃO DA API VIACEP */}
                <View style={styles.apiBox}>
                  <View style={styles.apiHeader}>
                    <Text style={styles.apiTitle}>🌐 Integração Externa: API ViaCEP</Text>
                  </View>
                  <Text style={styles.modalLabel}>CEP (apenas números)</Text>
                  <View style={styles.cepRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1 }]}
                      placeholder="Ex: 01001000"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      maxLength={9}
                      value={cep}
                      onChangeText={setCep}
                    />
                    <TouchableOpacity 
                      style={styles.cepSearchBtn} 
                      onPress={handleBuscarCep}
                      disabled={buscandoCep}
                    >
                      {buscandoCep ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <Text style={styles.cepSearchBtnText}>Buscar CEP</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.modalLabel}>Logradouro / Rua</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: Rua das Flores, 123"
                  placeholderTextColor={colors.textMuted}
                  value={logradouro}
                  onChangeText={setLogradouro}
                />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.modalLabel}>Cidade</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Cidade"
                      placeholderTextColor={colors.textMuted}
                      value={cidade}
                      onChangeText={setCidade}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>UF</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="UF"
                      placeholderTextColor={colors.textMuted}
                      maxLength={2}
                      autoCapitalize="characters"
                      value={uf}
                      onChangeText={setUf}
                    />
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.modalLabel}>Status: Ativo</Text>
                  <Switch
                    value={ativo}
                    onValueChange={setAtivo}
                    trackColor={{ false: "#334155", true: colors.primary }}
                    thumbColor={ativo ? "#000" : "#94a3b8"}
                  />
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
  locationBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#10131a",
    borderRadius: 6,
  },
  locationText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  streetText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    marginTop: 10,
    marginBottom: 12,
  },
  statusTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 11,
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
  apiBox: {
    backgroundColor: "rgba(245, 200, 66, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.2)",
    borderRadius: 8,
    padding: 10,
  },
  apiHeader: {
    marginBottom: 6,
  },
  apiTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cepRow: {
    flexDirection: "row",
    gap: 8,
  },
  cepSearchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cepSearchBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 13,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
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

