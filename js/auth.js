const Auth = {
  user: null,
  csrfToken: null,

  async init() {
    try {
      await this.refreshCsrf();
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        await DataSync.hydrate();
      }
    } catch (error) {
      console.error('Authentication initialization failed:', error);
    }
  },

  async refreshCsrf() {
    const response = await fetch('/api/auth/csrf');
    const data = await response.json();
    this.csrfToken = data.token;
  },

  async request(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (!this.csrfToken) await this.refreshCsrf();
      headers.set('X-CSRF-Token', this.csrfToken);
    }

    const response = await fetch(url, { ...options, method, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  },

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.user = data.user;
    await this.refreshCsrf();
    await DataSync.hydrate();
    return this.user;
  },

  async register(name, email, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.user = data.user;
    await this.refreshCsrf();
    await DataSync.hydrate();
    return this.user;
  },

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.user = null;
    DataSync.enabled = false;
    Storage.clearUserData();
  },
};
