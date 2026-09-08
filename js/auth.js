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

  async request(url, options = {}, allowCsrfRetry = true) {
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
    if (
      response.status === 403
      && data.error === 'Invalid or missing CSRF token'
      && allowCsrfRetry
    ) {
      this.csrfToken = null;
      await this.refreshCsrf();
      return this.request(url, options, false);
    }
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  },

  async login(identifier, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    this.user = data.user;
    await this.refreshCsrf();
    await DataSync.hydrate();
    Realtime.connect();
    await Notifications.init();
    return this.user;
  },

  async register(
    name,
    username,
    email,
    password
) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password }),
    });
    this.user = data.user;
    await this.refreshCsrf();
    await DataSync.hydrate();
    Realtime.connect();
    await Notifications.init();
    return this.user;
  },

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.user = null;
    this.csrfToken = null;
    DataSync.enabled = false;
    Storage.clearUserData();
    Realtime.disconnect();
    Notifications.reset();
    await this.refreshCsrf();
  },
};
