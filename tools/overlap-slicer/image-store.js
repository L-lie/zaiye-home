const OverlapImageStore = (() => {
  const DB_NAME = "ai-overlap-slicer";
  const DB_VERSION = 1;
  const STORE_NAME = "sources";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putSource(source) {
    const db = await openDb();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record = {
      ...source,
      id,
      createdAt: Date.now(),
    };

    await transact(db, "readwrite", (store) => store.put(record));
    db.close();
    return id;
  }

  async function getSource(id) {
    const db = await openDb();
    const record = await transact(db, "readonly", (store) => store.get(id));
    db.close();
    return record || null;
  }

  async function removeSource(id) {
    const db = await openDb();
    await transact(db, "readwrite", (store) => store.delete(id));
    db.close();
  }

  function transact(db, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    getSource,
    putSource,
    removeSource,
  };
})();
