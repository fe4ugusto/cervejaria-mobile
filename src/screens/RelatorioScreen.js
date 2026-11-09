import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from "react-native";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../config/firebase";
import { Header } from "../components/Header";
import { colors } from "../theme/colors";
import { syncService } from "../database/syncService";
import { getLocalCervejas, getLocalEstilos } from "../database/sqlite";

export function RelatorioScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("todos"); // "todos" | "estoque" | "vendas"

  const [cervejas, setCervejas] = useState([]);
  const [estilos, setEstilos] = useState([]);
  const [vendas, setVendas] = useState([]);

  // Métricas calculadas
  const [metricas, setMetricas] = useState({
    faturamentoTotal: 0,
    unidadesVendidas: 0,
    estoqueTotal: 0,
    totalEstilos: 0,
    totalCervejas: 0,
    topCervejasVendidas: [],
    estoquePorCerveja: [],
    distribuicaoPorEstilo: [],
    ultimasVendas: [],
  });

  const carregarDados = useCallback(async () => {
    try {
      // 1. Carrega Cervejas e Estilos do SQLite / Local
      let listaCervejas = [];
      let listaEstilos = [];

      try {
        listaCervejas = (await getLocalCervejas()) || [];
      } catch (err) {
        console.warn("Erro ao buscar cervejas do sqlite:", err);
      }

      try {
        listaEstilos = (await getLocalEstilos()) || [];
      } catch (err) {
        console.warn("Erro ao buscar estilos do sqlite:", err);
      }

      // Se o banco local estiver vazio e online, busca do Firestore para garantir
      if (listaCervejas.length === 0 && syncService.isOnline) {
        try {
          const snapC = await getDocs(collection(db, "cervejas"));
          listaCervejas = snapC.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("Fallback Firestore cervejas:", e);
        }
      }

      if (listaEstilos.length === 0 && syncService.isOnline) {
        try {
          const snapE = await getDocs(collection(db, "estilos"));
          listaEstilos = snapE.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("Fallback Firestore estilos:", e);
        }
      }

      setCervejas(listaCervejas);
      setEstilos(listaEstilos);

      // 2. Carrega Vendas do Firestore se online
      let listaVendas = [];
      if (syncService.isOnline) {
        try {
          const qVendas = query(collection(db, "vendas"), orderBy("criadoEm", "desc"), limit(50));
          const snap = await getDocs(qVendas);
          listaVendas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (err) {
          // Se falhar o orderBy (por falta de índice), tenta getDocs simples
          const snap = await getDocs(collection(db, "vendas"));
          listaVendas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      }

      setVendas(listaVendas);
      calcularRelatorios(listaCervejas, listaEstilos, listaVendas);
    } catch (e) {
      console.error("Erro ao carregar relatórios:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const calcularRelatorios = (beers, stylesList, sales) => {
    // Estoque total
    const totalEstoque = beers.reduce((acc, c) => acc + (Number(c.estoque) || 0), 0);

    // Mapeamento de estilos por ID
    const mapaEstilos = {};
    stylesList.forEach((e) => {
      mapaEstilos[e.id] = e.nome;
    });

    // Faturamento e unidades vendidas
    let totalFat = 0;
    let totalUnidades = 0;
    const vendasPorCervejaMap = {};

    sales.forEach((v) => {
      totalFat += Number(v.totalVenda) || 0;

      if (Array.isArray(v.itens)) {
        v.itens.forEach((it) => {
          const qty = Number(it.quantidade) || 0;
          const precoUnit = Number(it.precoUnitario) || 0;
          totalUnidades += qty;

          const beerName = it.cervejaNome || "Rótulo Desconhecido";
          if (!vendasPorCervejaMap[beerName]) {
            vendasPorCervejaMap[beerName] = { nome: beerName, unidades: 0, faturamento: 0 };
          }
          vendasPorCervejaMap[beerName].unidades += qty;
          vendasPorCervejaMap[beerName].faturamento += qty * precoUnit;
        });
      }
    });

    // Top vendidas ordenada
    const topVendidas = Object.values(vendasPorCervejaMap).sort(
      (a, b) => b.unidades - a.unidades
    );

    // Nível de estoque formatado
    const estoquePorCerveja = beers.map((c) => ({
      id: c.id,
      nome: c.nome,
      estilo: mapaEstilos[c.estiloId] || "Autoral",
      estoque: Number(c.estoque) || 0,
      preco: Number(c.preco) || 0,
    })).sort((a, b) => a.estoque - b.estoque);

    // Distribuição por estilo
    const contagemEstilos = {};
    beers.forEach((c) => {
      const nomeEstilo = mapaEstilos[c.estiloId] || "Outros";
      contagemEstilos[nomeEstilo] = (contagemEstilos[nomeEstilo] || 0) + 1;
    });

    const distribuicaoEstilos = Object.entries(contagemEstilos).map(([nome, count]) => ({
      nome,
      count,
      percentual: beers.length > 0 ? Math.round((count / beers.length) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    setMetricas({
      faturamentoTotal: totalFat,
      unidadesVendidas: totalUnidades,
      estoqueTotal: totalEstoque,
      totalEstilos: stylesList.length,
      totalCervejas: beers.length,
      topCervejasVendidas: topVendidas,
      estoquePorCerveja: estoquePorCerveja,
      distribuicaoPorEstilo: distribuicaoEstilos,
      ultimasVendas: sales.slice(0, 10),
    });
  };

  useEffect(() => {
    carregarDados();
    const unsubscribe = syncService.subscribe(() => {
      carregarDados();
    });
    return unsubscribe;
  }, [carregarDados]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarDados();
  };

  // Maior estoque para cálculo proporcional das barras
  const maxEstoque = Math.max(
    ...metricas.estoquePorCerveja.map((c) => c.estoque),
    30
  );

  // Maior venda para cálculo proporcional
  const maxVendas = Math.max(
    ...metricas.topCervejasVendidas.map((v) => v.unidades),
    10
  );

  return (
    <View style={styles.container}>
      <Header title="Relatórios e Desempenho" />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Calculando métricas e estoque...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* CARDS DE KPIS PRINCIPAIS */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, styles.kpiCardPrimary]}>
              <Text style={styles.kpiIcon}>💰</Text>
              <Text style={styles.kpiLabel}>Faturamento Total</Text>
              <Text style={styles.kpiValue}>
                R$ {metricas.faturamentoTotal.toFixed(2)}
              </Text>
              <Text style={styles.kpiSub}>Em pedidos realizados</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiIcon}>📦</Text>
              <Text style={styles.kpiLabel}>Unidades Vendidas</Text>
              <Text style={styles.kpiValue}>{metricas.unidadesVendidas} un</Text>
              <Text style={styles.kpiSub}>Total faturado no app</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiIcon}>🍺</Text>
              <Text style={styles.kpiLabel}>Estoque Disponível</Text>
              <Text style={styles.kpiValue}>{metricas.estoqueTotal} un</Text>
              <Text style={styles.kpiSub}>{metricas.totalCervejas} rótulos ativos</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiIcon}>🌾</Text>
              <Text style={styles.kpiLabel}>Estilos Cadastrados</Text>
              <Text style={styles.kpiValue}>{metricas.totalEstilos}</Text>
              <Text style={styles.kpiSub}>Variedades na cervejaria</Text>
            </View>
          </View>

          {/* FILTRO DE VISUALIZAÇÃO */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, activeTab === "todos" && styles.filterChipActive]}
              onPress={() => setActiveTab("todos")}
            >
              <Text style={[styles.filterChipText, activeTab === "todos" && styles.filterChipTextActive]}>
                Visão Completa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeTab === "estoque" && styles.filterChipActive]}
              onPress={() => setActiveTab("estoque")}
            >
              <Text style={[styles.filterChipText, activeTab === "estoque" && styles.filterChipTextActive]}>
                📊 Estoque
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeTab === "vendas" && styles.filterChipActive]}
              onPress={() => setActiveTab("vendas")}
            >
              <Text style={[styles.filterChipText, activeTab === "vendas" && styles.filterChipTextActive]}>
                📈 Vendas
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEÇÃO 1: GRÁFICO DE ESTOQUE POR CERVEJA */}
          {(activeTab === "todos" || activeTab === "estoque") && (
            <View style={styles.chartSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>📦 Nível de Estoque por Rótulo</Text>
                  <Text style={styles.sectionSubtitle}>
                    Acompanhamento em tempo real de garrafas e latas disponíveis
                  </Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                {metricas.estoquePorCerveja.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma cerveja cadastrada no momento.</Text>
                ) : (
                  metricas.estoquePorCerveja.map((c) => {
                    const pct = Math.min(100, Math.round((c.estoque / maxEstoque) * 100));
                    const isLow = c.estoque < 10;
                    const isMedium = c.estoque >= 10 && c.estoque < 20;

                    const barColor = isLow
                      ? colors.danger
                      : isMedium
                      ? colors.warning
                      : colors.success;

                    return (
                      <View key={c.id} style={styles.barItem}>
                        <View style={styles.barLabelRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                            <Text style={styles.barItemName} numberOfLines={1}>
                              {c.nome}
                            </Text>
                            <Text style={styles.barItemStyle}>({c.estilo})</Text>
                          </View>

                          <View style={styles.barValueBox}>
                            <Text style={[styles.barValueText, { color: barColor }]}>
                              {c.estoque} un
                            </Text>
                            {isLow && (
                              <View style={styles.lowStockBadge}>
                                <Text style={styles.lowStockText}>Baixo</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Barra visual de progresso */}
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${Math.max(6, pct)}%`,
                                backgroundColor: barColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Legenda do Gráfico */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>Seguro (≥ 20)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>Moderado (10-19)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.legendText}>Crítico (&lt; 10)</Text>
                </View>
              </View>
            </View>
          )}

          {/* SEÇÃO 2: GRÁFICO DE VENDAS POR RÓTULO */}
          {(activeTab === "todos" || activeTab === "vendas") && (
            <View style={styles.chartSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>🏆 Rótulos Mais Vendidos</Text>
                  <Text style={styles.sectionSubtitle}>
                    Volume de unidades comercializadas e faturamento
                  </Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                {metricas.topCervejasVendidas.length === 0 ? (
                  <View style={styles.emptySalesBox}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
                    <Text style={styles.emptyTitle}>Nenhuma venda registrada ainda</Text>
                    <Text style={styles.emptyDesc}>
                      Abra a aba "Catálogo" e finalize um pedido de teste para visualizar o gráfico de vendas!
                    </Text>
                  </View>
                ) : (
                  metricas.topCervejasVendidas.map((v, idx) => {
                    const pct = Math.min(100, Math.round((v.unidades / maxVendas) * 100));
                    return (
                      <View key={idx} style={styles.barItem}>
                        <View style={styles.barLabelRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                            <Text style={styles.rankingPosition}>#{idx + 1}</Text>
                            <Text style={styles.barItemName} numberOfLines={1}>
                              {v.nome}
                            </Text>
                          </View>

                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={[styles.barValueText, { color: colors.primary }]}>
                              {v.unidades} un
                            </Text>
                            <Text style={styles.salesRevenueText}>
                              R$ {v.faturamento.toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${Math.max(6, pct)}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* SEÇÃO 3: DISTRIBUIÇÃO POR ESTILO */}
          {(activeTab === "todos" || activeTab === "estoque") && (
            <View style={styles.chartSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>🌾 Distribuição por Estilo</Text>
                  <Text style={styles.sectionSubtitle}>
                    Proporção de rótulos disponíveis por estilo cervejeiro
                  </Text>
                </View>
              </View>

              <View style={styles.chartContainer}>
                {metricas.distribuicaoPorEstilo.length === 0 ? (
                  <Text style={styles.emptyText}>Sem estilos cadastrados.</Text>
                ) : (
                  metricas.distribuicaoPorEstilo.map((est, idx) => (
                    <View key={idx} style={styles.barItem}>
                      <View style={styles.barLabelRow}>
                        <Text style={styles.barItemName}>{est.nome}</Text>
                        <Text style={[styles.barValueText, { color: colors.info }]}>
                          {est.count} rótulo{est.count > 1 ? "s" : ""} ({est.percentual}%)
                        </Text>
                      </View>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(6, est.percentual)}%`,
                              backgroundColor: colors.info,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* SEÇÃO 4: HISTÓRICO DE ÚLTIMAS VENDAS */}
          {(activeTab === "todos" || activeTab === "vendas") && (
            <View style={styles.chartSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>📋 Últimos Pedidos no App</Text>
                  <Text style={styles.sectionSubtitle}>
                    Registro de compras sincronizadas no Firestore
                  </Text>
                </View>
              </View>

              {metricas.ultimasVendas.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum histórico recente disponível.</Text>
              ) : (
                metricas.ultimasVendas.map((pedido) => (
                  <View key={pedido.id} style={styles.orderCard}>
                    <View style={styles.orderTopRow}>
                      <View>
                        <Text style={styles.orderBuyer}>👤 {pedido.comprador || "Cliente"}</Text>
                        <Text style={styles.orderDate}>
                          {pedido.enderecoEntrega || "Entrega no balcão"}
                        </Text>
                      </View>
                      <View style={styles.orderTotalBox}>
                        <Text style={styles.orderTotalValue}>
                          R$ {Number(pedido.totalVenda || 0).toFixed(2)}
                        </Text>
                        <View style={styles.orderStatusPill}>
                          <Text style={styles.orderStatusText}>{pedido.status || "Confirmado"}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Resumo de itens */}
                    {Array.isArray(pedido.itens) && (
                      <View style={styles.orderItemsList}>
                        {pedido.itens.map((i, iIdx) => (
                          <Text key={iIdx} style={styles.orderItemText}>
                            • {i.quantidade}x {i.cervejaNome} (R$ {Number(i.precoUnitario || 0).toFixed(2)})
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  kpiCardPrimary: {
    borderColor: "rgba(245, 200, 66, 0.4)",
    backgroundColor: "rgba(245, 200, 66, 0.05)",
  },
  kpiIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  kpiLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  kpiValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 2,
  },
  kpiSub: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#161922",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#0c0d0f",
  },
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chartContainer: {
    gap: 14,
  },
  barItem: {
    gap: 6,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankingPosition: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  barItemName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 150,
  },
  barItemStyle: {
    color: colors.textMuted,
    fontSize: 11,
  },
  barValueBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barValueText: {
    fontSize: 13,
    fontWeight: "700",
  },
  lowStockBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  lowStockText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "800",
  },
  salesRevenueText: {
    color: colors.textMuted,
    fontSize: 10,
  },
  barTrack: {
    height: 10,
    backgroundColor: "#0d1017",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptySalesBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyDesc: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  orderCard: {
    backgroundColor: "#0d1017",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderBuyer: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  orderDate: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    maxWidth: 200,
  },
  orderTotalBox: {
    alignItems: "flex-end",
  },
  orderTotalValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  orderStatusPill: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  orderStatusText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: "700",
  },
  orderItemsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  orderItemText: {
    color: "#94a3b8",
    fontSize: 11,
    marginBottom: 2,
  },
});

