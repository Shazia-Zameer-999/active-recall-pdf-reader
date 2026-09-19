window.Pages.Landing = {
  render() {
    const userIsSignedIn = typeof Auth !== 'undefined' && Auth.user;
    const primaryAction = userIsSignedIn ? '#/dashboard' : '#auth-form';
    const primaryActionLabel = userIsSignedIn ? 'Open Dashboard' : 'Get Started';

    return `
      <div class="landing">
        <header class="landing-nav">
          <div class="brand" style="display: flex; align-items: center; gap: 8px;">
            <span class="brand-icon" style="font-size: 24px;">🧠</span>
            <span class="brand-name" style="font-weight: 800; font-size: 20px; letter-spacing: -0.02em;">RecalIo</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="landing-theme-toggle" class="icon-btn" type="button" aria-label="Switch theme">
              <span id="landing-theme-icon">${Theme.current() === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <a href="${primaryAction}" class="btn btn-primary">${primaryActionLabel}</a>
          </div>
        </header>

        <section class="landing-hero">
          <div class="pill-title" style="background: rgba(99, 102, 241, 0.15); color: var(--accent); margin-bottom: 12px; display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 12px;">
            ⚡ The Active Recall Engine
          </div>
          <h1>Turn anything you consume into something you remember.</h1>
          <p class="hero-subtitle">
            An AI-powered active-recall layer that turns passive reading, videos, and idle train travel into permanent neural retention.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 16px;">
            <a href="#/dashboard" class="btn btn-primary btn-lg">Start Learning</a>
            <a href="#/group" class="btn btn-secondary-sm btn-lg" style="font-weight: 700; padding: 12px 22px;">Join Study Pod</a>
          </div>
        </section>

        ${userIsSignedIn ? `
          <section class="auth-card auth-signed-in">
            <h2>Welcome back, ${this.escapeHtml(Auth.user.name)}.</h2>
            <p>Your study data is synced to your account.</p>
            <a href="#/dashboard" class="btn btn-primary">Open Dashboard</a>
          </section>
        ` : `
          <section class="auth-card" id="auth-form">
            <h2 id="auth-title">Sign in to RecalIo</h2>
            <p id="auth-subtitle">Your PDFs, notes, and progress will be saved securely.</p>
            <form id="auth-form-element">
              <input id="auth-name" class="manual-form-input auth-register-field" type="text" placeholder="Your name" autocomplete="name" hidden />
              <input
                id="auth-username"
                class="manual-form-input auth-register-field"
                type="text"
                placeholder="Username"
                autocomplete="username"
                hidden
              />
              <input
                id="auth-identifier"
                class="manual-form-input"
                type="text"
                placeholder="Email or Username"
                autocomplete="username"
                required
              />
              <input id="auth-password" class="manual-form-input" type="password" placeholder="Password (8+ characters)" autocomplete="current-password" minlength="8" required />
              <button id="auth-submit" class="btn btn-primary" type="submit">Sign in</button>
              <p id="auth-status" class="auth-status" role="status"></p>
            </form>
            <button id="auth-toggle" class="btn btn-secondary-sm" type="button">Create an account</button>
          </section>
        `}

        <section class="landing-features">
          <div class="feature-card">
            <span class="feature-icon">⚡</span>
            <h3>In-Flow Gated Recall</h3>
            <p>Adaptive checkpoints pause passive skimming; answer to unlock the next chapter.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">👥</span>
            <h3>Study Pods (#POD-782)</h3>
            <p>Live green focus signals keep friend groups accountable, culminating in instant AI quiz battles.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🚆</span>
            <h3>Train & Travel Mode</h3>
            <p>Pre-download offline task packs and duel nearby passengers via Bluetooth with 0 cellular data.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🔁</span>
            <h3>SM-2 Spaced Repetition</h3>
            <p>Missed concepts automatically bridge into an SM-2 decay schedule so nothing is ever forgotten.</p>
          </div>
        </section>
      </div>
    `;
  },

  afterRender() {
    const themeBtn = document.getElementById("landing-theme-toggle");
    if (themeBtn) {
      const icon = document.getElementById("landing-theme-icon");
      themeBtn.addEventListener("click", () => {
        Theme.toggle();
        const isDark = Theme.current() === "dark";
        if (icon) icon.textContent = isDark ? "☀️" : "🌙";
      });
    }

    const form = document.getElementById('auth-form-element');
    if (!form) return;

    let registerMode = false;
    const nameInput = document.getElementById('auth-name');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submit = document.getElementById('auth-submit');
    const toggle = document.getElementById('auth-toggle');
    const status = document.getElementById('auth-status');

    toggle.addEventListener('click', () => {
      registerMode = !registerMode;
      const identifierInput = document.getElementById("auth-identifier");

      identifierInput.placeholder = registerMode ? "Email address" : "Email or Username";
      identifierInput.autocomplete = registerMode ? "email" : "username";
      nameInput.hidden = !registerMode;
      const usernameInput = document.getElementById("auth-username");

      usernameInput.hidden = !registerMode;
      usernameInput.required = registerMode;
      nameInput.required = registerMode;
      title.textContent = registerMode ? 'Create your RecalIo account' : 'Sign in to RecalIo';
      subtitle.textContent = registerMode
        ? 'Keep your study data synced across sessions.'
        : 'Your PDFs, notes, and progress are saved securely.';
      submit.textContent = registerMode ? 'Create account' : 'Sign in';
      toggle.textContent = registerMode ? 'I already have an account' : 'Create an account';
      document.getElementById('auth-password').autocomplete = registerMode ? 'new-password' : 'current-password';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = 'Please wait...';
      submit.disabled = true;
      try {
        const usernameInput = document.getElementById("auth-username");
        const identifierInput = document.getElementById("auth-identifier");

        const value = identifierInput.value.trim();
        const password = document.getElementById('auth-password').value;
        if (typeof Auth !== 'undefined') {
          if (registerMode) {
            await Auth.register(
              nameInput.value.trim(),
              usernameInput.value.trim(),
              value,
              password
            );
          } else {
            await Auth.login(value, password);
          }
        }
        Router.navigate('/dashboard');
      } catch (error) {
        status.textContent = error.message;
        submit.disabled = false;
      }
    });
  },

  escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[character]));
  },
};
