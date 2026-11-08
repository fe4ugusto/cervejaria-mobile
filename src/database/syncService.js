import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  getPendingSyncData,
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
    this.initNetworkListener();
  }

  // Notifica componentes inscritos sobre alterações de status
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

  // Inicializa a escuta de conectividade
  initNetworkListener() {
    // Tratamento para Web
    if (Platform.OS === "web" && typeof window !== "undefined") {
      this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notify();
        this.syncAll();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
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

          if (wasOffline && online) {
            console.log("📶 Conexão restabelecida! Iniciando sincronização automática...");
            this.syncAll();
          }
        });

        NetInfo.fetch().then((state) => {
          this.isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
          this.notify();
        }).catch((err) => {
          console.warn("NetInfo fetch warning:", err);
        });
      }
    } catch (err) {
      console.warn("NetInfo listener warning:", err);
    }
  }

  /**
   * Sincronização bidirecional entre SQLite e Firestore
   */
  async syncAll() {
    if (this.isSyncing) return;
    if (!this.isOnline) return;

    this.isSyncing = true;
    this.notify();

    try {
      // 1. Enviar pendências locais para o Firestore
      const { estilos, fornecedores, cervejas } = await getPendingSyncData();

      // Sincronizar Estilos pendentes
      for (const e of estilos) {
        if (e.sync_status === "pending_delete") {
          await deleteDoc(doc(db, "estilos", e.id));
          await removeLocalEstiloPermanently(e.id);
        } else {
          // pending_create ou pending_update
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
        } else {
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
        } else {
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

      // 2. Atualizar dados locais com o Firestore
      const [snapEstilos, snapFornecedores, snapCervejas] = await Promise.all([
        getDocs(collection(db, "estilos")),
        getDocs(collection(db, "fornecedores")),
        getDocs(collection(db, "cervejas")),
      ]);

      for (const d of snapEstilos.docs) {
        await upsertLocalEstilo({ id: d.id, ...d.data() }, "synced");
      }

      for (const d of snapFornecedores.docs) {
        await upsertLocalFornecedor({ id: d.id, ...d.data() }, "synced");
      }

      for (const d of snapCervejas.docs) {
        await upsertLocalCerveja({ id: d.id, ...d.data() }, "synced");
      }

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

