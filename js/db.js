const DB = {
  _db: null,
  DB_NAME: 'recall_app_db',
  DB_VERSION: 1,
  STORE_NAME: 'pdfs',

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB failed to open:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  savePDF({ id, name, file, totalPages = null }) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const record = { id, name, file, totalPages, uploadedAt: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  },

  getPDF(id) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this.STORE_NAME, 'readonly');
      const request = tx.objectStore(this.STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  getAllPDFs() {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this.STORE_NAME, 'readonly');
      const request = tx.objectStore(this.STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  deletePDF(id) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
      const request = tx.objectStore(this.STORE_NAME).delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
};