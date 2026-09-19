// js/layout.js — RecalIo Navigation & Shell Layout

const Layout = {
  navItems: [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/reader', label: 'Read', icon: '📖' },
    { path: '/group', label: 'Group Mode', icon: '👥' },
    { path: '/travel', label: 'Travel Mode', icon: '🚆' },
    { path: '/review', label: 'Review', icon: '🔁' },
    { path: '/analytics', label: 'Progress', icon: '📈' },
    { path: '/library', label: 'Library', icon: '📚' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
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
            <!-- Age-Adaptive Skin Selector (Feature 7) -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Skin:</span>
              <select id="age-skin-select" class="page-input" style="width: auto; font-size: 11px; font-weight: 700; height: 32px;" title="Age-Adaptive Content Skin">
                <option value="3-6" ${currentAgeSkin === '3-6' ? 'selected' : ''}>👶 3–6 (Early Wonder)</option>
                <option value="6-12" ${currentAgeSkin === '6-12' ? 'selected' : ''}>🎮 6–12 (Quest Mode)</option>
                <option value="12-19" ${currentAgeSkin === '12-19' ? 'selected' : ''}>🎓 12–19 (Exam Gladiator)</option>
                <option value="adults" ${currentAgeSkin === 'adults' ? 'selected' : ''}>💼 Adults (Executive)</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button id="timer-toggle-btn" class="icon-btn" title="Pomodoro Focus Timer">⏱️</button>
              <button id="theme-toggle-btn" class="icon-btn" title="Toggle theme">
                <span id="theme-icon">${Theme.current() === 'dark' ? '☀️' : '🌙'}</span>
              </button>
            </div>
          </header>
          <main class="page-content">${pageContent}</main>
        </div>
      </div>
    `;
  },

  afterRender() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        Theme.toggle();
        document.getElementById('theme-icon').textContent =
          Theme.current() === 'dark' ? '☀️' : '🌙';
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
  },
};