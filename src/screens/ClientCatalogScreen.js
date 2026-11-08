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
  ScrollView
} from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { getLocalCervejas, getLocalEstilos, upsertLocalCerveja } from "../database/sqlite";
import { syncService } from "../database/syncService";
import { consultarCep } from "../services/cepApi";
import { db } from "../config/firebase";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";

export function ClientCatalogScreen() {
  const { user, logout, toggleRole } = useAuth();
  const [cervejas, setCervejas] = useState([]);
  const [estilos, setEstilos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroEstilo, setFiltroEstilo] = useState("");

  // Carrinho de Compras
  const [carrinho, setCarrinho] = useState([]);
  const [carrinhoVisible, setCarrinhoVisible] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Endereço e API ViaCEP para Entrega
  const [cepEntrega, setCepEntrega] = useState("");
  const [enderecoEntrega, setEnderecoEntrega] = useState(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Histórico de Pedidos do Cliente
  const [pedidosVisible, setPedidosVisible] = useState(false);
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);

  useEffect(() => {
    carregarCatalogo();
    const unsubscribe = syncService.subscribe(() => {
      carregarCatalogo();
    });
    return unsubscribe;
  }, []);

  const carregarCatalogo = async () => {
    try {
      const [listaCervejas, listaEstilos] = await Promise.all([
        getLocalCervejas(),
        getLocalEstilos(),
      ]);
      setCervejas(listaCervejas);
      setEstilos(listaEstilos);
    } catch (e) {
      console.error("Erro ao carregar catálogo:", e);
    } finally {
      setLoading(false);
    }
  };

  const getNomeEstilo = (id) => estilos.find((e) => e.id === id)?.nome || "Artesanal";

  // Gerenciamento do Carrinho
  const adicionarAoCarrinho = (cerveja) => {
    const estoque = cerveja.estoque || 0;
    if (estoque <= 0) {
      Alert.alert("Indisponível", "Este item encontra-se temporariamente sem estoque.");
      return;
    }

    const itemExistente = carrinho.find((i) => i.id === cerveja.id);
    const qtdAtual = itemExistente ? itemExistente.quantidade : 0;

    if (qtdAtual >= estoque) {
      Alert.alert("Limite de estoque", `Quantidade máxima disponível: ${estoque} unidade(s).`);
      return;
    }

    if (itemExistente) {
      setCarrinho(
        carrinho.map((i) => (i.id === cerveja.id ? { ...i, quantidade: i.quantidade + 1 } : i))
      );
    } else {
      setCarrinho([...carrinho, { ...cerveja, quantidade: 1 }]);
    }
  };

  const alterarQuantidade = (id, delta) => {
    const cerveja = cervejas.find((c) => c.id === id);
    const estoque = cerveja ? cerveja.estoque : 99;

    setCarrinho((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const novaQtd = item.quantidade + delta;
            if (novaQtd > estoque) {
              Alert.alert("Limite de estoque", `Estoque máximo atingido (${estoque} unidade(s)).`);
              return item;
            }
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  // Consulta do CEP de entrega pela API ViaCEP
  const handleConsultarCepEntrega = async () => {
    if (!cepEntrega.trim()) {
      Alert.alert("Aviso", "Por favor, informe o CEP para calcular a entrega.");
      return;
    }

    setBuscandoCep(true);
    try {
      const dados = await consultarCep(cepEntrega);
      if (dados) {
        setEnderecoEntrega(dados);
        Alert.alert(
          "Endereço confirmado",
          `${dados.logradouro ? dados.logradouro + ", " : ""}${dados.bairro} - ${dados.cidade}/${dados.uf}`
        );
      }
    } catch (err) {
      Alert.alert("Consulta de CEP", err.message || "Não foi possível localizar o endereço para o CEP informado.");
    } finally {
      setBuscandoCep(false);
    }
  };

  // Finalizar Compra
  const handleFinalizarPedido = async () => {
    if (carrinho.length === 0) return;

    if (!enderecoEntrega) {
      Alert.alert("Aviso", "Por favor, confirme o endereço de entrega antes de finalizar o pedido.");
      return;
    }

    setFinalizando(true);
    try {
      const itens = carrinho.map((i) => ({
        cervejaId: i.id,
        cervejaNome: i.nome,
        quantidade: i.quantidade,
        precoUnitario: Number(i.preco),
        subtotal: Number(i.preco) * i.quantidade,
      }));

      const totalVenda = itens.reduce((acc, i) => acc + i.subtotal, 0);

      const novoPedido = {
        comprador: user?.email || "cliente@cervejaria.com",
        compradorNome: user?.name || user?.email || "Cliente",
        itens,
        totalVenda,
        enderecoEntrega: `${enderecoEntrega.logradouro}, ${enderecoEntrega.bairro} - ${enderecoEntrega.cidade}/${enderecoEntrega.uf} (CEP: ${enderecoEntrega.cep})`,
        status: "Pendente",
        criadoEm: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      };

      // Salva no Firestore
      if (syncService.isOnline) {
        await addDoc(collection(db, "vendas"), novoPedido);
      }

      // Dá baixa no estoque das cervejas localmente
      for (const item of carrinho) {
        const cerveja = cervejas.find((c) => c.id === item.id);
        if (cerveja) {
          const novoEstoque = Math.max(0, (cerveja.estoque || 0) - item.quantidade);
          await upsertLocalCerveja({ ...cerveja, estoque: novoEstoque }, "synced");
          if (syncService.isOnline) {
            await updateDoc(doc(db, "cervejas", item.id), { estoque: novoEstoque });
          }
        }
      }

      setCarrinho([]);
      setCarrinhoVisible(false);
      setEnderecoEntrega(null);
      setCepEntrega("");
      await carregarCatalogo();

      Alert.alert("Pedido confirmado", "Seu pedido foi registrado com sucesso e está em processamento.");
    } catch (err) {
      console.error("Erro ao finalizar pedido:", err);
      Alert.alert("Erro", "Não foi possível processar o pedido. Tente novamente.");
    } finally {
      setFinalizando(false);
    }
  };

  // Carrega histórico de pedidos
  const carregarMeusPedidos = async () => {
    setCarregandoPedidos(true);
    setPedidosVisible(true);
    try {
      if (syncService.isOnline && user?.email) {
        const q = query(collection(db, "vendas"), where("comprador", "==", user.email));
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMeusPedidos(lista);
      } else {
        setMeusPedidos([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoPedidos(false);
    }
  };

  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
  const valorTotal = carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  const cervejasFiltradas = cervejas.filter((c) => {
    const nomeValido = c.nome.toLowerCase().includes(busca.toLowerCase());
    const estiloValido = !filtroEstilo || c.estiloId === filtroEstilo;
    return nomeValido && estiloValido;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>🍻</Text>
          <View>
            <Text style={styles.headerTitle}>Cervejaria Artesanal</Text>
            <Text style={styles.headerSubtitle}>
              Olá, {user?.name || user?.email?.split("@")[0] || "Cliente"}!
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.pedidosBtn} onPress={carregarMeusPedidos}>
            <Text style={styles.pedidosBtnText}>📦 Pedidos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner */}
      <View style={styles.heroBanner}>
        <Text style={styles.heroTitle}>Catálogo & Delivery</Text>
        <Text style={styles.heroText}>
          Cervejas artesanais selecionadas. Peça pelo app e receba no seu endereço.
        </Text>
      </View>

      {/* Filtros e busca */}
      <View style={styles.filterSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar cerveja artesanal..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />

        {/* Chips de estilos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, filtroEstilo === "" && styles.chipActive]}
            onPress={() => setFiltroEstilo("")}
          >
            <Text style={[styles.chipText, filtroEstilo === "" && styles.chipTextActive]}>
              🍻 Todos
            </Text>
          </TouchableOpacity>
          {estilos.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[styles.chip, filtroEstilo === e.id && styles.chipActive]}
              onPress={() => setFiltroEstilo(e.id)}
            >
              <Text style={[styles.chipText, filtroEstilo === e.id && styles.chipTextActive]}>
                {e.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTAGEM DE PRODUTOS PARA COMPRA */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando catálogo cervejeiro...</Text>
        </View>
      ) : cervejasFiltradas.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🍺</Text>
          <Text style={styles.emptyTitle}>Nenhuma cerveja encontrada</Text>
          <Text style={styles.emptySubtitle}>Ajuste os filtros de busca para encontrar rótulos.</Text>
        </View>
      ) : (
        <FlatList
          data={cervejasFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const noCarrinho = carrinho.find((i) => i.id === item.id)?.quantidade || 0;
            const estoqueDisponivel = item.estoque || 0;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.beerName}>{item.nome}</Text>
                    <Text style={styles.beerStyle}>🌾 {getNomeEstilo(item.estiloId)}</Text>
                  </View>
                  <Text style={styles.beerPrice}>R$ {Number(item.preco || 0).toFixed(2)}</Text>
                </View>

                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <Text style={[styles.badgeText, { color: colors.warning }]}>IBU {item.ibu || "—"}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: "rgba(129, 140, 248, 0.15)" }]}>
                    <Text style={[styles.badgeText, { color: "#818cf8" }]}>ABV {item.abv}%</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: estoqueDisponivel > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)" }]}>
                    <Text style={[styles.badgeText, { color: estoqueDisponivel > 0 ? colors.success : colors.danger }]}>
                      {estoqueDisponivel > 0 ? `📦 Restam ${estoqueDisponivel}` : "Esgotado"}
                    </Text>
                  </View>
                </View>

                {/* Controles do carrinho */}
                <View style={styles.actionRow}>
                  {estoqueDisponivel <= 0 ? (
                    <Text style={styles.outOfStockText}>Sem estoque no momento</Text>
                  ) : noCarrinho > 0 ? (
                    <View style={styles.qtyContainer}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => alterarQuantidade(item.id, -1)}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{noCarrinho}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => adicionarAoCarrinho(item)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => adicionarAoCarrinho(item)}>
                      <Text style={styles.addBtnText}>+ Adicionar ao Pedido</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Botão flutuante do carrinho */}
      {totalItens > 0 && (
        <TouchableOpacity style={styles.fabCart} onPress={() => setCarrinhoVisible(true)}>
          <Text style={styles.fabIcon}>🛒</Text>
          <Text style={styles.fabText}>Ver Carrinho ({totalItens})</Text>
          <Text style={styles.fabTotal}>R$ {valorTotal.toFixed(2)}</Text>
        </TouchableOpacity>
      )}

      {/* Modal do carrinho */}
      <Modal visible={carrinhoVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>🛒 Seu Pedido</Text>

              {/* LISTA DE ITENS DO CARRINHO */}
              <View style={styles.carrinhoItens}>
                {carrinho.map((item) => (
                  <View key={item.id} style={styles.carrinhoItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemNome}>{item.nome}</Text>
                      <Text style={styles.itemSub}>R$ {Number(item.preco).toFixed(2)} un.</Text>
                    </View>
                    <View style={styles.itemQtyRow}>
                      <TouchableOpacity style={styles.itemQtyBtn} onPress={() => alterarQuantidade(item.id, -1)}>
                        <Text style={styles.itemQtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.itemQtyText}>{item.quantidade}</Text>
                      <TouchableOpacity style={styles.itemQtyBtn} onPress={() => alterarQuantidade(item.id, 1)}>
                        <Text style={styles.itemQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Endereço de entrega */}
              <View style={styles.apiEntregaBox}>
                <View style={styles.apiHeaderRow}>
                  <Text style={styles.apiTag}>📍 Endereço de Entrega</Text>
                  <Text style={styles.apiSubtitle}>Consulta automática via CEP</Text>
                </View>

                <View style={styles.cepInputRow}>
                  <TextInput
                    style={styles.cepInput}
                    placeholder="Digite o CEP (Ex: 01001000)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    maxLength={9}
                    value={cepEntrega}
                    onChangeText={setCepEntrega}
                  />
                  <TouchableOpacity
                    style={styles.cepBtn}
                    onPress={handleConsultarCepEntrega}
                    disabled={buscandoCep}
                  >
                    {buscandoCep ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.cepBtnText}>Buscar CEP</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {enderecoEntrega && (
                  <View style={styles.enderecoResultBox}>
                    <Text style={styles.enderecoResultTitle}>📍 Endereço de Entrega Confirmado:</Text>
                    <Text style={styles.enderecoResultText}>
                      {enderecoEntrega.logradouro}, {enderecoEntrega.bairro}
                    </Text>
                    <Text style={styles.enderecoResultCity}>
                      {enderecoEntrega.cidade} - {enderecoEntrega.uf} (CEP: {enderecoEntrega.cep})
                    </Text>
                  </View>
                )}
              </View>

              {/* TOTAL DO PEDIDO */}
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total a pagar:</Text>
                <Text style={styles.totalValue}>R$ {valorTotal.toFixed(2)}</Text>
              </View>

              {/* BOTÕES DE FINALIZAÇÃO */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCarrinhoVisible(false)}>
                  <Text style={styles.cancelBtnText}>Continuar Comprando</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, finalizando && { opacity: 0.7 }]}
                  onPress={handleFinalizarPedido}
                  disabled={finalizando}
                >
                  {finalizando ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirmar Pedido</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL DE HISTÓRICO: MEUS PEDIDOS */}
      <Modal visible={pedidosVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>📦 Histórico de Pedidos</Text>

            {carregandoPedidos ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
            ) : meusPedidos.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🍺</Text>
                <Text style={{ color: colors.textMuted }}>Você ainda não realizou nenhum pedido.</Text>
              </View>
            ) : (
              <FlatList
                data={meusPedidos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.pedidoCard}>
                    <View style={styles.pedidoHeader}>
                      <Text style={styles.pedidoTotal}>R$ {Number(item.totalVenda || 0).toFixed(2)}</Text>
                      <View style={styles.pedidoStatusPill}>
                        <Text style={styles.pedidoStatusText}>{item.status || "Pendente"}</Text>
                      </View>
                    </View>
                    <Text style={styles.pedidoEndereco}>{item.enderecoEntrega || "Entrega no balcão"}</Text>
                    <View style={styles.pedidoItensList}>
                      {(item.itens || []).map((prod, idx) => (
                        <Text key={idx} style={styles.pedidoItemRow}>
                          • {prod.quantidade}x {prod.cervejaNome}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              />
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setPedidosVisible(false)}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#11141c",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    fontSize: 26,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  pedidosBtn: {
    backgroundColor: "#1c2230",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2d3748",
  },
  pedidosBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "bold",
  },
  logoutBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "bold",
  },
  heroBanner: {
    padding: 16,
    backgroundColor: "#131722",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  heroTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  filterSection: {
    padding: 16,
    gap: 10,
  },
  searchInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "#161b26",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#252d3d",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#000",
    fontWeight: "bold",
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
    paddingBottom: 90,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  beerName: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
  },
  beerStyle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  beerPrice: {
    color: colors.success,
    fontSize: 18,
    fontWeight: "bold",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  qtyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d1017",
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  qtyBtn: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
  },
  qtyValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "bold",
  },
  outOfStockText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
  },
  fabCart: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  fabText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "bold",
    flex: 1,
  },
  fabTotal: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 16,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCard: {
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
  carrinhoItens: {
    gap: 10,
    marginBottom: 16,
  },
  carrinhoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#10141d",
    padding: 12,
    borderRadius: 8,
  },
  itemNome: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  itemSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  itemQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemQtyBtn: {
    backgroundColor: "#1e2638",
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  itemQtyBtnText: {
    color: colors.text,
    fontWeight: "bold",
  },
  itemQtyText: {
    color: colors.primary,
    fontWeight: "bold",
    fontSize: 14,
    minWidth: 16,
    textAlign: "center",
  },
  apiEntregaBox: {
    backgroundColor: "rgba(245, 200, 66, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.25)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  apiHeaderRow: {
    marginBottom: 8,
  },
  apiTag: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "bold",
  },
  apiSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cepInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  cepInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  cepBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cepBtnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
  },
  enderecoResultBox: {
    backgroundColor: "#10131b",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  enderecoResultTitle: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "bold",
  },
  enderecoResultText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  enderecoResultCity: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d1017",
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  totalLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  totalValue: {
    color: colors.success,
    fontSize: 20,
    fontWeight: "bold",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#1c2230",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "bold",
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "bold",
  },
  pedidoCard: {
    backgroundColor: "#10141d",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  pedidoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pedidoTotal: {
    color: colors.success,
    fontSize: 16,
    fontWeight: "bold",
  },
  pedidoStatusPill: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pedidoStatusText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "bold",
  },
  pedidoEndereco: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  pedidoItensList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 6,
  },
  pedidoItemRow: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: "#1c2230",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 14,
  },
  closeBtnText: {
    color: colors.text,
    fontWeight: "bold",
  },
});

