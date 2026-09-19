// js/layout.js — RecalIo Navigation & Shell Layout

const Layout = {
  navItems: [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/reader', label: 'Read', icon: '📖' },
    { path: '/group', label: 'Study Pods', icon: '👥' },
    { path: '/travel', label: 'Travel Mode', icon: '🚆' },
    { path: '/review', label: 'Review', icon: '🔁' },
    { path: '/analytics', label: 'Progress', icon: '📈' },
    { path: '/library', label: 'Library', icon: '📚' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/friends', label: 'Friends', icon: '🤝' },
    { path: '/groups', label: 'Groups', icon: '🏛️' },
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

    const currentAgeSkin = window.Gamification ? window.Gamification.getAgeBracket() : '12-19';

    return `
      <div class="app-shell">
        <div id="sidebar-backdrop" class="sidebar-backdrop" aria-hidden="true"></div>
        <aside class="sidebar">
          <div class="sidebar-brand">
            <span class="brand-icon">🧠</span>
            <div>
              <div class="brand-name" style="letter-spacing: -0.02em; font-weight: 800;">RecalIo</div>
              <div style="font-size: 9.5px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">The Active Recall Engine</div>
            </div>
          </div>
          <nav class="sidebar-nav">${navLinksHtml}</nav>
        </aside>

        <div class="main-column">
          <header class="topbar">
            <button id="mobile-menu-btn" class="icon-btn mobile-menu-btn" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
            
            <!-- Age-Adaptive Skin Selector (Feature 7) -->
            <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Skin:</span>
              <select id="age-skin-select" class="page-input" style="width: auto; font-size: 11px; font-weight: 700; height: 32px;" title="Age-Adaptive Content Skin">
                <option value="3-6" ${currentAgeSkin === '3-6' ? 'selected' : ''}>👶 3–6 (Early Wonder)</option>
                <option value="6-12" ${currentAgeSkin === '6-12' ? 'selected' : ''}>🎮 6–12 (Quest Mode)</option>
                <option value="12-19" ${currentAgeSkin === '12-19' ? 'selected' : ''}>🎓 12–19 (Exam Gladiator)</option>
                <option value="adults" ${currentAgeSkin === 'adults' ? 'selected' : ''}>💼 Adults (Executive)</option>
              </select>
            </div>

            <div class="topbar-spacer" style="flex: 1;"></div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button id="timer-toggle-btn" class="icon-btn" title="Pomodoro Timer">⏱️</button>
              <button id="theme-toggle-btn" class="icon-btn" title="Toggle theme">
                <span id="theme-icon">${Theme.current() === 'dark' ? '☀️' : '🌙'}</span>
              </button>
              <button id="command-palette-btn" class="command-shortcut" type="button" title="Open command palette">⌘ K</button>
              <div class="notification-wrap">
                <button id="notification-btn" class="icon-btn" type="button" title="Notifications" aria-label="Notifications">🔔<span id="notification-badge" class="notification-badge" hidden></span></button>
                <div id="notification-popover" class="notification-popover"><div id="notification-list"></div></div>
              </div>
              <span class="topbar-user" title="Signed in account">${Layout.escapeHtml((typeof Auth !== 'undefined' && Auth.user?.name) || 'Student')}</span>
              <button id="logout-btn" class="btn btn-secondary-sm">Log out</button>
            </div>
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
        document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
        const brandLogo = document.getElementById('brand-logo');
        if (brandLogo) {
          brandLogo.src = isDark ? 'assets/main2.svg' : 'assets/main.svg';
        }
      });
    }

    const timerBtn = document.getElementById('timer-toggle-btn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => Timer.toggleVisibility());
    }

    const ageSelect = document.getElementById('age-skin-select');
    if (ageSelect) {
      ageSelect.addEventListener('change', (e) => {
        if (window.Gamification) {
          window.Gamification.setAgeBracket(e.target.value);
          window.Gamification.showToast(`Switched to ${ageSelect.selectedOptions[0].text}`);
        }
      });
    }

    document.getElementById('command-palette-btn')?.addEventListener('click', () => {
      if (typeof CommandPalette !== 'undefined') CommandPalette.open();
    });

    document.getElementById('notification-btn')?.addEventListener('click', () => {
      if (typeof Notifications !== 'undefined') Notifications.toggle();
    });
    if (typeof Notifications !== 'undefined') {
      Notifications.render();
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
          if (typeof Auth !== 'undefined') {
            await Auth.logout();
          }
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
