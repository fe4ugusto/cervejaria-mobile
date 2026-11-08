import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Interface SQLite para ambiente Web (usando AsyncStorage com schema de tabelas)
 */
export async function getDatabase() {
  return null;
}

async function getWebList(key) {
  try {
    const raw = await AsyncStorage.getItem(`@sqlite_table_${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveWebList(key, list) {
  await AsyncStorage.setItem(`@sqlite_table_${key}`, JSON.stringify(list));
}

// Operações locais — Estilos

export async function getLocalEstilos() {
  const list = await getWebList("estilos");
  return list.filter(e => e.sync_status !== "pending_delete");
}

export async function upsertLocalEstilo(estilo, syncStatus = "synced") {
  const item = { ...estilo, sync_status: syncStatus, updatedAt: Date.now() };
  const list = await getWebList("estilos");
  const idx = list.findIndex(e => e.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveWebList("estilos", list);
  return item;
}

export async function markLocalEstiloDeleted(id) {
  const list = await getWebList("estilos");
  const item = list.find(e => e.id === id);
  if (item) {
    item.sync_status = "pending_delete";
    item.updatedAt = Date.now();
    await saveWebList("estilos", list);
  }
}

export async function removeLocalEstiloPermanently(id) {
  const list = await getWebList("estilos");
  await saveWebList("estilos", list.filter(e => e.id !== id));
}

// Operações locais — Fornecedores

export async function getLocalFornecedores() {
  const list = await getWebList("fornecedores");
  return list.filter(f => f.sync_status !== "pending_delete");
}

export async function upsertLocalFornecedor(fornecedor, syncStatus = "synced") {
  const item = {
    ...fornecedor,
    ativo: fornecedor.ativo !== false,
    sync_status: syncStatus,
    updatedAt: Date.now()
  };
  const list = await getWebList("fornecedores");
  const idx = list.findIndex(f => f.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveWebList("fornecedores", list);
  return item;
}

export async function markLocalFornecedorDeleted(id) {
  const list = await getWebList("fornecedores");
  const item = list.find(f => f.id === id);
  if (item) {
    item.sync_status = "pending_delete";
    item.updatedAt = Date.now();
    await saveWebList("fornecedores", list);
  }
}

export async function removeLocalFornecedorPermanently(id) {
  const list = await getWebList("fornecedores");
  await saveWebList("fornecedores", list.filter(f => f.id !== id));
}

// Operações locais — Cervejas

export async function getLocalCervejas() {
  const list = await getWebList("cervejas");
  return list.filter(c => c.sync_status !== "pending_delete");
}

export async function upsertLocalCerveja(cerveja, syncStatus = "synced") {
  const item = {
    ...cerveja,
    ibu: Number(cerveja.ibu) || 0,
    abv: Number(cerveja.abv) || 0,
    preco: Number(cerveja.preco) || 0,
    estoque: Number(cerveja.estoque) || 0,
    sync_status: syncStatus,
    updatedAt: Date.now()
  };
  const list = await getWebList("cervejas");
  const idx = list.findIndex(c => c.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  await saveWebList("cervejas", list);
  return item;
}

export async function markLocalCervejaDeleted(id) {
  const list = await getWebList("cervejas");
  const item = list.find(c => c.id === id);
  if (item) {
    item.sync_status = "pending_delete";
    item.updatedAt = Date.now();
    await saveWebList("cervejas", list);
  }
}

export async function removeLocalCervejaPermanently(id) {
  const list = await getWebList("cervejas");
  await saveWebList("cervejas", list.filter(c => c.id !== id));
}

// Consultas de sincronização

export async function getPendingSyncData() {
  const [e, f, c] = await Promise.all([
    getWebList("estilos"),
    getWebList("fornecedores"),
    getWebList("cervejas")
  ]);
  return {
    estilos: e.filter(item => item.sync_status && item.sync_status.startsWith("pending_")),
    fornecedores: f.filter(item => item.sync_status && item.sync_status.startsWith("pending_")),
    cervejas: c.filter(item => item.sync_status && item.sync_status.startsWith("pending_"))
  };
}
