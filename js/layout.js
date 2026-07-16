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
        <aside class="sidebar">
          <div class="sidebar-brand">
            <span class="brand-icon">🧠</span>
            <span class="brand-name">Recall</span>
          </div>
          <nav class="sidebar-nav">${navLinksHtml}</nav>
        </aside>

        <div class="main-column">
          <header class="topbar">
            <button id="theme-toggle-btn" class="icon-btn" title="Toggle theme">
              <span id="theme-icon">${Theme.current() === 'dark' ? '☀️' : '🌙'}</span>
            </button>
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
  },
};