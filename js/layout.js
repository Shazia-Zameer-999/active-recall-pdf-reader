const Layout = {
  navItems: [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/library', label: 'Library', icon: '📚' },
    { path: '/reader', label: 'Reader', icon: '📖' },
    { path: '/notes', label: 'Notes', icon: '📝' },
    { path: '/flashcards', label: 'Flashcards', icon: '🗂️' },
    { path: '/quiz', label: 'Quiz', icon: '❓' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/friends', label: 'Friends', icon: '🤝' },
    { path: '/groups', label: 'Groups', icon: '👥' },
  ],

  render(pageContent, activePath) {
    const navLinksHtml = this.navItems
      .map(
        (item) => `
        <a href="#${item.path}" class="nav-link ${activePath === item.path ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </a>`
      )
      .join('');

    return `
      <div class="app-shell">
        <div id="sidebar-backdrop" class="sidebar-backdrop" aria-hidden="true"></div>
        <aside class="sidebar">
          <div class="sidebar-brand">
    <span class="brand-icon">
        <img
            id="brand-logo"
            src="assets/${Theme.current() === 'dark' ? 'main2.svg' : 'main.svg'}"
            alt="ImpactX Logo"
        >
    </span>

    <span class="brand-name">
        ImpactX
    </span>
</div>
          <nav class="sidebar-nav">${navLinksHtml}</nav>
        </aside>

        <div class="main-column">
          <header class="topbar">
            <button id="mobile-menu-btn" class="icon-btn mobile-menu-btn" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
            <div class="topbar-spacer"></div>
            <button id="timer-toggle-btn" class="icon-btn" title="Pomodoro Timer">⏱️</button>
            <button id="theme-toggle-btn" class="icon-btn" title="Toggle theme">
              <span id="theme-icon">${Theme.current() === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <button id="command-palette-btn" class="command-shortcut" type="button" title="Open command palette">⌘ K</button>
            <div class="notification-wrap">
              <button id="notification-btn" class="icon-btn" type="button" title="Notifications" aria-label="Notifications">🔔<span id="notification-badge" class="notification-badge" hidden></span></button>
              <div id="notification-popover" class="notification-popover"><div id="notification-list"></div></div>
            </div>
            <span class="topbar-user" title="Signed in account">${Layout.escapeHtml(Auth.user?.name || 'Student')}</span>
            <button id="logout-btn" class="btn btn-secondary-sm">Log out</button>
          </header>
          <main class="page-content">${pageContent}</main>
        </div>
      </div>
    `;
  },

  afterRender() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeMenu = () => {
      document.body.classList.remove('menu-open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    };
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const isOpen = document.body.classList.toggle('menu-open');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }
    backdrop?.addEventListener('click', closeMenu);
    document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    }, { once: true });

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
          Theme.toggle();

          const isDark = Theme.current() === 'dark';

          document.getElementById('theme-icon').textContent =
              isDark ? '☀️' : '🌙';

          document.getElementById('brand-logo').src =
              isDark ? 'assets/main2.svg' : 'assets/main.svg';
      });
    }

    const timerBtn = document.getElementById('timer-toggle-btn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => Timer.toggleVisibility());
    }

    document.getElementById('command-palette-btn')?.addEventListener('click', () => CommandPalette.open());
    document.getElementById('notification-btn')?.addEventListener('click', () => Notifications.toggle());
    Notifications.render();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
          await Auth.logout();
          Router.navigate('/');
        } catch (error) {
          console.error('Logout failed:', error);
          logoutBtn.disabled = false;
        }
      });
    }
  },

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  },
};
