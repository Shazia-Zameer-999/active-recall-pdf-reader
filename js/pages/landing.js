window.Pages.Landing = {
  render() {
    return `
      <div class="landing">
        <header class="landing-nav">
          <div class="brand">
            <span class="brand-icon">🧠</span>
            <span class="brand-name">Recall</span>
          </div>
          <a href="#auth-form" class="btn btn-primary">Get Started</a>
        </header>

        <section class="landing-hero">
          <span class="hero-kicker">ACTIVE RECALL / AI PDF READER</span>
          <h1>Turn reading into remembering.</h1>
          <p class="hero-subtitle">
            Read smarter with an AI study companion that turns your PDFs into
            questions, flashcards, and lasting memory.
          </p>
          <a href="#auth-form" class="btn btn-primary btn-lg">Start Studying</a>
        </section>

        ${Auth.user ? `
          <section class="auth-card auth-signed-in">
            <h2>Welcome back, ${this.escapeHtml(Auth.user.name)}.</h2>
            <p>Your study data is synced to your account.</p>
            <a href="#/dashboard" class="btn btn-primary">Open Dashboard</a>
          </section>
        ` : `
          <section class="auth-card" id="auth-form">
            <h2 id="auth-title">Sign in to Recall</h2>
            <p id="auth-subtitle">Your PDFs, notes, and progress will be saved securely.</p>
            <form id="auth-form-element">
              <input id="auth-name" class="manual-form-input auth-register-field" type="text" placeholder="Your name" autocomplete="name" hidden />
              <input id="auth-email" class="manual-form-input" type="email" placeholder="Email address" autocomplete="email" required />
              <input id="auth-password" class="manual-form-input" type="password" placeholder="Password (8+ characters)" autocomplete="current-password" minlength="8" required />
              <button id="auth-submit" class="btn btn-primary" type="submit">Sign in</button>
              <p id="auth-status" class="auth-status" role="status"></p>
            </form>
            <button id="auth-toggle" class="btn btn-secondary-sm" type="button">Create an account</button>
          </section>
        `}

        <section class="landing-features">
          <div class="feature-card">
            <span class="feature-icon">🔁</span>
            <h3>Active Recall</h3>
            <p>Get quizzed on what you just read, right inside the PDF.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">✨</span>
            <h3>AI Summaries</h3>
            <p>Instant chapter summaries, flashcards, and quizzes from any PDF.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">📈</span>
            <h3>Track Progress</h3>
            <p>See your reading streaks, recall accuracy, and weak topics.</p>
          </div>
        </section>
      </div>
    `;
  },

  afterRender() {
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
      nameInput.hidden = !registerMode;
      nameInput.required = registerMode;
      title.textContent = registerMode ? 'Create your Recall account' : 'Sign in to Recall';
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
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        if (registerMode) {
          await Auth.register(nameInput.value.trim(), email, password);
        } else {
          await Auth.login(email, password);
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
