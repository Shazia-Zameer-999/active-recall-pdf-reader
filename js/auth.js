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
        if (typeof DataSync !== 'undefined') await DataSync.hydrate();
      }
    } catch (error) {
      console.warn('Backend authentication server not reached (offline/local mode).');
    }

    // If not signed into backend, check for a persisted local session or create a default guest session
    if (!this.user) {
      const localUser = localStorage.getItem('recalio_user');
      if (localUser) {
        try {
          this.user = JSON.parse(localUser);
        } catch (e) {
          this.user = null;
        }
      }
    }

    // Default guest student so reader, study pods, and flashcards work immediately even offline
    if (!this.user) {
      this.user = {
        name: 'Student',
        username: 'guest_student',
        email: 'guest@recalio.app',
        isGuest: true,
      };
    }
  },

  async refreshCsrf() {
    try {
      const response = await fetch('/api/auth/csrf');
      if (response.ok) {
        const data = await response.json();
        this.csrfToken = data.token;
      }
    } catch (e) {
      // Offline mode
    }
  },

  async request(url, options = {}, allowCsrfRetry = true) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (!this.csrfToken) await this.refreshCsrf();
      if (this.csrfToken) headers.set('X-CSRF-Token', this.csrfToken);
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
    try {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      this.user = data.user;
      await this.refreshCsrf();
      if (typeof DataSync !== 'undefined') await DataSync.hydrate();
      if (typeof Realtime !== 'undefined') Realtime.connect();
      if (typeof Notifications !== 'undefined') await Notifications.init();
      return this.user;
    } catch (error) {
      // If backend is offline, create a local session so the user can study
      console.warn('Backend unavailable, using local student session:', error.message);
      this.user = {
        name: identifier.includes('@') ? identifier.split('@')[0] : identifier,
        username: identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@recalio.app`,
        isLocal: true,
      };
      localStorage.setItem('recalio_user', JSON.stringify(this.user));
      return this.user;
    }
  },

  async register(name, username, email, password) {
    try {
      const data = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, username, email, password }),
      });
      this.user = data.user;
      await this.refreshCsrf();
      if (typeof DataSync !== 'undefined') await DataSync.hydrate();
      if (typeof Realtime !== 'undefined') Realtime.connect();
      if (typeof Notifications !== 'undefined') await Notifications.init();
      return this.user;
    } catch (error) {
      console.warn('Backend unavailable, creating local profile:', error.message);
      this.user = {
        name: name || username,
        username,
        email,
        isLocal: true,
      };
      localStorage.setItem('recalio_user', JSON.stringify(this.user));
      return this.user;
    }
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.user = {
      name: 'Student',
      username: 'guest_student',
      email: 'guest@recalio.app',
      isGuest: true,
    };
    this.csrfToken = null;
    localStorage.removeItem('recalio_user');
    if (typeof DataSync !== 'undefined') DataSync.enabled = false;
    Storage.clearUserData();
    if (typeof Realtime !== 'undefined') Realtime.disconnect();
    if (typeof Notifications !== 'undefined') Notifications.reset();
  },
};
