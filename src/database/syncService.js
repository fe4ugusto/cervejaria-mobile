import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  getPendingSyncData,
  getLocalEstilos,
  getLocalFornecedores,
  getLocalCervejas,
  upsertLocalEstilo,
  upsertLocalFornecedor,
  upsertLocalCerveja,
  removeLocalEstiloPermanently,
  removeLocalFornecedorPermanently,
  removeLocalCervejaPermanently,
} from "./sqlite";

class SyncService {
  constructor() {
    this.isOnline = true;
    this.isSyncing = false;
    this.listeners = new Set();
    this.unsubscribers = [];
    this.initNetworkListener();

    // Sincronização inicial automática e início dos listeners em tempo real
    setTimeout(() => {
      if (this.isOnline) {
        this.syncAll();
        this.startRealtimeListeners();
      }
    }, 1000);
  }

  // Notifica componentes inscritos sobre alterações de status ou novos dados
  subscribe(callback) {
    this.listeners.add(callback);
    callback({ isOnline: this.isOnline, isSyncing: this.isSyncing });
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((cb) =>
      cb({ isOnline: this.isOnline, isSyncing: this.isSyncing })
    );
  }

  // Listeners em tempo real do Firestore (garantem sincronização instantânea entre Web e Mobile)
  startRealtimeListeners() {
    if (this.unsubscribers.length > 0) return;

    try {
      // 1. Ouvir alterações em Cervejas
      const unsubCervejas = onSnapshot(collection(db, "cervejas"), async (snapshot) => {
        let changed = false;
        for (const change of snapshot.docChanges()) {
          const docData = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "added" || change.type === "modified") {
            await upsertLocalCerveja(docData, "synced");
            changed = true;
          } else if (change.type === "removed") {
            await removeLocalCervejaPermanently(change.doc.id);
            changed = true;
          }
        }
        if (changed) this.notify();
      }, (err) => {
        console.warn("Snapshot cervejas info:", err?.message || err);
      });

      // 2. Ouvir alterações em Estilos
      const unsubEstilos = onSnapshot(collection(db, "estilos"), async (snapshot) => {
        let changed = false;
        for (const change of snapshot.docChanges()) {
          const docData = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "added" || change.type === "modified") {
            await upsertLocalEstilo(docData, "synced");
            changed = true;
          } else if (change.type === "removed") {
            await removeLocalEstiloPermanently(change.doc.id);
            changed = true;
          }
        }
        if (changed) this.notify();
      }, (err) => {
        console.warn("Snapshot estilos info:", err?.message || err);
      });

      // 3. Ouvir alterações em Fornecedores
      const unsubFornecedores = onSnapshot(collection(db, "fornecedores"), async (snapshot) => {
        let changed = false;
        for (const change of snapshot.docChanges()) {
          const docData = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "added" || change.type === "modified") {
            await upsertLocalFornecedor(docData, "synced");
            changed = true;
          } else if (change.type === "removed") {
            await removeLocalFornecedorPermanently(change.doc.id);
            changed = true;
          }
        }
        if (changed) this.notify();
      }, (err) => {
        console.warn("Snapshot fornecedores info:", err?.message || err);
      });

      this.unsubscribers = [unsubCervejas, unsubEstilos, unsubFornecedores];
    } catch (err) {
      console.warn("Erro ao registrar listeners em tempo real:", err);
    }
  }

  stopRealtimeListeners() {
    this.unsubscribers.forEach((unsub) => {
      try {
        if (typeof unsub === "function") unsub();
      } catch (e) {}
    });
    this.unsubscribers = [];
  }

  // Inicializa a escuta de conectividade
  initNetworkListener() {
    // Tratamento para Web
    if (Platform.OS === "web" && typeof window !== "undefined") {
      this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notify();
        this.startRealtimeListeners();
        this.syncAll();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.stopRealtimeListeners();
        this.notify();
      });
      return;
    }

    // Tratamento para Mobile Nativo
    try {
      if (NetInfo && NetInfo.addEventListener) {
        NetInfo.addEventListener((state) => {
          const online = Boolean(state.isConnected && state.isInternetReachable !== false);
          const wasOffline = !this.isOnline;
          this.isOnline = online;
          this.notify();

          if (online) {
            this.startRealtimeListeners();
          } else {
            this.stopRealtimeListeners();
          }

          if (wasOffline && online) {
            console.log("📶 Conexão restabelecida! Sincronizando dados pendentes...");
            this.syncAll();
          }
        });

        NetInfo.fetch().then((state) => {
          this.isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
          this.notify();
          if (this.isOnline) {
            this.startRealtimeListeners();
          }
        }).catch((err) => {
          console.warn("NetInfo fetch warning:", err);
        });
      }
    } catch (err) {
      console.warn("NetInfo listener warning:", err);
    }
  }

  /**
   * Sincronização bidirecional inteligente entre SQLite e Firestore
   * @param {boolean} forceUploadAll Se true, força o upload de registros locais
   */
  async syncAll(forceUploadAll = false) {
    if (this.isSyncing) return;
    if (!this.isOnline) return;

    this.isSyncing = true;
    this.notify();

    try {
      // 1. Enviar registros pendentes locais para o Firestore (offline-first)
      let estilos = [];
      let fornecedores = [];
      let cervejas = [];

      if (forceUploadAll) {
        const [allE, allF, allC] = await Promise.all([
          getLocalEstilos(),
          getLocalFornecedores(),
          getLocalCervejas(),
        ]);
        estilos = allE;
        fornecedores = allF;
        cervejas = allC;
      } else {
        const pendentes = await getPendingSyncData();
        estilos = pendentes.estilos;
        fornecedores = pendentes.fornecedores;
        cervejas = pendentes.cervejas;
      }

      // Sincronizar Estilos pendentes
      for (const e of estilos) {
        if (e.sync_status === "pending_delete") {
          await deleteDoc(doc(db, "estilos", e.id));
          await removeLocalEstiloPermanently(e.id);
        } else if (e.sync_status !== "synced" || forceUploadAll) {
          await setDoc(doc(db, "estilos", e.id), {
            nome: e.nome,
            origem: e.origem,
            amargor: e.amargor,
            atualizadoEm: serverTimestamp(),
          });
          await upsertLocalEstilo(e, "synced");
        }
      }

      // Sincronizar Fornecedores pendentes
      for (const f of fornecedores) {
        if (f.sync_status === "pending_delete") {
          await deleteDoc(doc(db, "fornecedores", f.id));
          await removeLocalFornecedorPermanently(f.id);
        } else if (f.sync_status !== "synced" || forceUploadAll) {
          await setDoc(doc(db, "fornecedores", f.id), {
            nome: f.nome,
            contato: f.contato,
            cep: f.cep || "",
            logradouro: f.logradouro || "",
            bairro: f.bairro || "",
            cidade: f.cidade || "",
            uf: f.uf || "",
            ativo: Boolean(f.ativo),
            atualizadoEm: serverTimestamp(),
          });
          await upsertLocalFornecedor(f, "synced");
        }
      }

      // Sincronizar Cervejas pendentes
      for (const c of cervejas) {
        if (c.sync_status === "pending_delete") {
          await deleteDoc(doc(db, "cervejas", c.id));
          await removeLocalCervejaPermanently(c.id);
        } else if (c.sync_status !== "synced" || forceUploadAll) {
          await setDoc(doc(db, "cervejas", c.id), {
            nome: c.nome,
            estiloId: c.estiloId,
            fornecedorId: c.fornecedorId,
            ibu: Number(c.ibu),
            abv: Number(c.abv),
            preco: Number(c.preco),
            estoque: Number(c.estoque),
            imagemUrl: c.imagemUrl || "",
            atualizadoEm: serverTimestamp(),
          });
          await upsertLocalCerveja(c, "synced");
        }
      }

      // 2. Atualizar dados locais com o Firestore (A nuvem é a fonte da verdade)
      const [snapEstilos, snapFornecedores, snapCervejas] = await Promise.all([
        getDocs(collection(db, "estilos")),
        getDocs(collection(db, "fornecedores")),
        getDocs(collection(db, "cervejas")),
      ]);

      const firestoreEstiloIds = new Set(snapEstilos.docs.map((d) => d.id));
      const firestoreFornecIds = new Set(snapFornecedores.docs.map((d) => d.id));
      const firestoreCervejaIds = new Set(snapCervejas.docs.map((d) => d.id));

      for (const d of snapEstilos.docs) {
        await upsertLocalEstilo({ id: d.id, ...d.data() }, "synced");
      }

      for (const d of snapFornecedores.docs) {
        await upsertLocalFornecedor({ id: d.id, ...d.data() }, "synced");
      }

      for (const d of snapCervejas.docs) {
        await upsertLocalCerveja({ id: d.id, ...d.data() }, "synced");
      }

      // 3. Remover registros locais sincronizados que não existem mais no Firestore
      const [allLocalE, allLocalF, allLocalC] = await Promise.all([
        getLocalEstilos(),
        getLocalFornecedores(),
        getLocalCervejas(),
      ]);

      for (const e of allLocalE) {
        if (e.sync_status === "synced" && !firestoreEstiloIds.has(e.id)) {
          await removeLocalEstiloPermanently(e.id);
        }
      }

      for (const f of allLocalF) {
        if (f.sync_status === "synced" && !firestoreFornecIds.has(f.id)) {
          await removeLocalFornecedorPermanently(f.id);
        }
      }

      for (const c of allLocalC) {
        if (c.sync_status === "synced" && !firestoreCervejaIds.has(c.id)) {
          await removeLocalCervejaPermanently(c.id);
        }
      }

      // Garante que os listeners em tempo real estão ativos
      this.startRealtimeListeners();

      console.log("✅ Sincronização concluída com sucesso!");
    } catch (error) {
      console.error("❌ Erro durante a sincronização:", error);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncService = new SyncService();
