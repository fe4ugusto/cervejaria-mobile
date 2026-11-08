import * as SQLite from "expo-sqlite";

let dbInstance = null;

/**
 * Obtém ou inicializa a conexão com o banco SQLite local (Android / iOS)
 */
export async function getDatabase() {
  if (dbInstance) return dbInstance;

  if (SQLite.openDatabaseAsync) {
    dbInstance = await SQLite.openDatabaseAsync("cervejaria.db");
  } else if (SQLite.openDatabaseSync) {
    dbInstance = SQLite.openDatabaseSync("cervejaria.db");
  } else {
    dbInstance = SQLite.openDatabase("cervejaria.db");
  }

  await initDatabase(dbInstance);
  return dbInstance;
}

/**
 * Cria as tabelas do SQLite local com suporte a flags de sincronização
 */
async function initDatabase(db) {
  const schemaQueries = `
    CREATE TABLE IF NOT EXISTS estilos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      origem TEXT,
      amargor TEXT,
      sync_status TEXT DEFAULT 'synced',
      updatedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      contato TEXT,
      cep TEXT,
      logradouro TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      ativo INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'synced',
      updatedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS cervejas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      estiloId TEXT,
      fornecedorId TEXT,
      ibu REAL,
      abv REAL,
      preco REAL,
      estoque INTEGER,
      imagemUrl TEXT,
      sync_status TEXT DEFAULT 'synced',
      updatedAt INTEGER
    );
  `;

  if (db.execAsync) {
    await db.execAsync(schemaQueries);
  }
}

// Operações locais — Estilos

export async function getLocalEstilos() {
  const db = await getDatabase();
  const query = "SELECT * FROM estilos WHERE sync_status != 'pending_delete' ORDER BY nome ASC";
  if (db.getAllAsync) return await db.getAllAsync(query);

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(query, [], (_, { rows }) => resolve(rows._array || []), (_, err) => reject(err));
    });
  });
}

export async function upsertLocalEstilo(estilo, syncStatus = "synced") {
  const db = await getDatabase();
  const item = { ...estilo, sync_status: syncStatus, updatedAt: Date.now() };

  const query = `
    INSERT OR REPLACE INTO estilos (id, nome, origem, amargor, sync_status, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  const params = [item.id, item.nome, item.origem || "", item.amargor || "", syncStatus, item.updatedAt];

  if (db.runAsync) return await db.runAsync(query, params);

  return new Promise((resolve, reject) => {
    db.transaction(tx => tx.executeSql(query, params, (_, res) => resolve(res), (_, err) => reject(err)));
  });
}

export async function markLocalEstiloDeleted(id) {
  const db = await getDatabase();
  const query = "UPDATE estilos SET sync_status = 'pending_delete', updatedAt = ? WHERE id = ?";
  return db.runAsync ? await db.runAsync(query, [Date.now(), id]) : null;
}

export async function removeLocalEstiloPermanently(id) {
  const db = await getDatabase();
  const query = "DELETE FROM estilos WHERE id = ?";
  if (db.runAsync) return await db.runAsync(query, [id]);
}

// Operações locais — Fornecedores

export async function getLocalFornecedores() {
  const db = await getDatabase();
  const query = "SELECT * FROM fornecedores WHERE sync_status != 'pending_delete' ORDER BY nome ASC";
  if (db.getAllAsync) {
    const list = await db.getAllAsync(query);
    return list.map(f => ({ ...f, ativo: Boolean(f.ativo) }));
  }

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(query, [], (_, { rows }) => {
        resolve((rows._array || []).map(f => ({ ...f, ativo: Boolean(f.ativo) })));
      }, (_, err) => reject(err));
    });
  });
}

export async function upsertLocalFornecedor(fornecedor, syncStatus = "synced") {
  const db = await getDatabase();
  const item = {
    ...fornecedor,
    ativo: fornecedor.ativo !== false,
    sync_status: syncStatus,
    updatedAt: Date.now()
  };

  const query = `
    INSERT OR REPLACE INTO fornecedores (id, nome, contato, cep, logradouro, bairro, cidade, uf, ativo, sync_status, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const params = [
    item.id,
    item.nome,
    item.contato || "",
    item.cep || "",
    item.logradouro || "",
    item.bairro || "",
    item.cidade || "",
    item.uf || "",
    item.ativo ? 1 : 0,
    syncStatus,
    item.updatedAt
  ];

  if (db.runAsync) return await db.runAsync(query, params);

  return new Promise((resolve, reject) => {
    db.transaction(tx => tx.executeSql(query, params, (_, res) => resolve(res), (_, err) => reject(err)));
  });
}

export async function markLocalFornecedorDeleted(id) {
  const db = await getDatabase();
  const query = "UPDATE fornecedores SET sync_status = 'pending_delete', updatedAt = ? WHERE id = ?";
  return db.runAsync ? await db.runAsync(query, [Date.now(), id]) : null;
}

export async function removeLocalFornecedorPermanently(id) {
  const db = await getDatabase();
  const query = "DELETE FROM fornecedores WHERE id = ?";
  if (db.runAsync) return await db.runAsync(query, [id]);
}

// Operações locais — Cervejas

export async function getLocalCervejas() {
  const db = await getDatabase();
  const query = "SELECT * FROM cervejas WHERE sync_status != 'pending_delete' ORDER BY nome ASC";
  if (db.getAllAsync) return await db.getAllAsync(query);

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(query, [], (_, { rows }) => resolve(rows._array || []), (_, err) => reject(err));
    });
  });
}

export async function upsertLocalCerveja(cerveja, syncStatus = "synced") {
  const db = await getDatabase();
  const item = {
    ...cerveja,
    ibu: Number(cerveja.ibu) || 0,
    abv: Number(cerveja.abv) || 0,
    preco: Number(cerveja.preco) || 0,
    estoque: Number(cerveja.estoque) || 0,
    sync_status: syncStatus,
    updatedAt: Date.now()
  };

  const query = `
    INSERT OR REPLACE INTO cervejas (id, nome, estiloId, fornecedorId, ibu, abv, preco, estoque, imagemUrl, sync_status, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const params = [
    item.id,
    item.nome,
    item.estiloId || "",
    item.fornecedorId || "",
    item.ibu,
    item.abv,
    item.preco,
    item.estoque,
    item.imagemUrl || "",
    syncStatus,
    item.updatedAt
  ];

  if (db.runAsync) return await db.runAsync(query, params);

  return new Promise((resolve, reject) => {
    db.transaction(tx => tx.executeSql(query, params, (_, res) => resolve(res), (_, err) => reject(err)));
  });
}

export async function markLocalCervejaDeleted(id) {
  const db = await getDatabase();
  const query = "UPDATE cervejas SET sync_status = 'pending_delete', updatedAt = ? WHERE id = ?";
  return db.runAsync ? await db.runAsync(query, [Date.now(), id]) : null;
}

export async function removeLocalCervejaPermanently(id) {
  const db = await getDatabase();
  const query = "DELETE FROM cervejas WHERE id = ?";
  if (db.runAsync) return await db.runAsync(query, [id]);
}

// Consultas de sincronização

export async function getPendingSyncData() {
  const db = await getDatabase();
  const queryPending = table => `SELECT * FROM ${table} WHERE sync_status LIKE 'pending_%'`;

  if (db.getAllAsync) {
    const estilos = await db.getAllAsync(queryPending("estilos"));
    const fornecedores = await db.getAllAsync(queryPending("fornecedores"));
    const cervejas = await db.getAllAsync(queryPending("cervejas"));
    return { estilos, fornecedores, cervejas };
  }

  return { estilos: [], fornecedores: [], cervejas: [] };
}

