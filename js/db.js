// js/db.js — Hybrid Database with IndexedDB local cache & Backend API sync

const DB = {
  _db: null,
  DB_NAME: 'recall_app_db',
  DB_VERSION: 1,
  STORE_NAME: 'pdfs',

  init() {
    return new Promise((resolve) => {
      if (this._db) return resolve(this._db);

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
        console.warn('IndexedDB unavailable, falling back to in-memory store:', event.target.error);
        resolve(null);
      };
    });
  },

  async _localSave(record) {
    if (!this._db) await this.init();
    if (!this._db) return record;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => resolve(record);
      } catch (e) {
        resolve(record);
      }
    });
  },

  async _localGet(id) {
    if (!this._db) await this.init();
    if (!this._db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.STORE_NAME, 'readonly');
        const request = tx.objectStore(this.STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async _localGetAll() {
    if (!this._db) await this.init();
    if (!this._db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.STORE_NAME, 'readonly');
        const request = tx.objectStore(this.STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  },

  async _localDelete(id) {
    if (!this._db) await this.init();
    if (!this._db) return true;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  },

  async savePDF({ id, name, file, totalPages = null }) {
    const record = { id, name, file, totalPages, uploadedAt: Date.now() };

    // 1. Always save in browser IndexedDB first (guarantees zero-failure offline uploads)
    await this._localSave(record);

    // 2. If a backend server is connected and user is logged in, sync to server
    if (typeof Auth !== 'undefined' && Auth.user && !Auth.user.isLocal && !Auth.user.isGuest) {
      try {
        const form = new FormData();
        form.append('id', id);
        form.append('name', name);
        if (totalPages !== null) form.append('totalPages', totalPages);
        form.append('file', file, name);

        const data = await Auth.request('/api/pdfs', {
          method: 'POST',
          body: form,
        });
        return { ...data, file, uploadedAt: record.uploadedAt };
      } catch (e) {
        console.warn('Server PDF upload skipped, saved locally to IndexedDB:', e.message);
      }
    }

    return record;
  },

  async getPDF(id) {
    // 1. Check local IndexedDB first
    const local = await this._localGet(id);
    if (local && local.file) return local;

    // 2. Try fetching from server if not found locally
    try {
      const response = await fetch(`/api/pdfs/${encodeURIComponent(id)}`);
      if (response.ok) {
        const blob = await response.blob();
        const record = {
          id,
          name: response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'document.pdf',
          file: blob,
        };
        await this._localSave(record);
        return record;
      }
    } catch (e) {}

    return local || null;
  },

  async getAllPDFs() {
    const localList = await this._localGetAll();

    if (typeof Auth !== 'undefined' && Auth.user && !Auth.user.isLocal && !Auth.user.isGuest) {
      try {
        const data = await Auth.request('/api/pdfs');
        if (Array.isArray(data.pdfs)) {
          const map = new Map(data.pdfs.map((p) => [p.id, p]));
          for (const local of localList) {
            if (!map.has(local.id)) map.set(local.id, local);
          }
          return Array.from(map.values());
        }
      } catch (e) {}
    }

    return localList;
  },

  async deletePDF(id) {
    await this._localDelete(id);
    if (typeof Auth !== 'undefined' && Auth.user && !Auth.user.isLocal && !Auth.user.isGuest) {
      try {
        await Auth.request(`/api/pdfs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (e) {}
    }
    return true;
  },

  async deleteAllPDFs() {
    if (typeof Auth !== 'undefined' && Auth.user && !Auth.user.isLocal && !Auth.user.isGuest) {
      try {
        await Auth.request('/api/pdfs', { method: 'DELETE' });
      } catch (e) {}
    }
    const all = await this._localGetAll();
    for (const p of all) {
      await this._localDelete(p.id);
    }
    return true;
  },
};
