const CommandPalette = {
  items: [
    { label: 'Open Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Open Library', path: '/library', icon: '📚' },
    { label: 'Open Notes', path: '/notes', icon: '📝' },
    { label: 'Open Flashcards', path: '/flashcards', icon: '🗂️' },
    { label: 'Open Quiz', path: '/quiz', icon: '❓' },
    { label: 'Open Analytics', path: '/analytics', icon: '📈' },
    { label: 'Open Settings', path: '/settings', icon: '⚙️' },
    { label: 'Open Profile', path: '/profile', icon: '👤' },
  ],

  init() {
    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.toggle();
      }
      if (event.key === 'Escape') this.close();
    });
  },

  toggle() {
    const overlay = document.getElementById('command-palette');
    if (overlay?.classList.contains('is-open')) this.close();
    else this.open();
  },

  open() {
    let overlay = document.getElementById('command-palette');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'command-palette';
      overlay.className = 'command-palette';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.close();
      });
    }
    overlay.classList.add('is-open');
    this.render('');
    overlay.querySelector('.command-search').focus();
  },

  close() {
    document.getElementById('command-palette')?.classList.remove('is-open');
  },

  render(query) {
    const overlay = document.getElementById('command-palette');
    if (!overlay) return;
    const normalized = query.toLowerCase();
    const matches = this.items.filter((item) => item.label.toLowerCase().includes(normalized));
    overlay.innerHTML = `
      <div class="command-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="command-search-row">
          <span class="command-search-icon">⌘</span>
          <input class="command-search" type="search" placeholder="Search pages and actions..." aria-label="Search pages and actions" value="${this.escapeHtml(query)}" />
          <kbd>ESC</kbd>
        </div>
        <div class="command-results">
          ${matches.length ? matches.map((item) => `
            <button class="command-result" type="button" data-path="${item.path}">
              <span>${item.icon}</span><span>${item.label}</span><kbd>Enter</kbd>
            </button>
          `).join('') : '<p class="command-empty">No matching actions</p>'}
        </div>
        <p class="command-footer">Use <kbd>↑</kbd> <kbd>↓</kbd> to browse · <kbd>⌘ K</kbd> to toggle</p>
      </div>
    `;
    const search = overlay.querySelector('.command-search');
    search.addEventListener('input', () => this.render(search.value));
    overlay.querySelectorAll('.command-result').forEach((button) => {
      button.addEventListener('click', () => {
        this.close();
        Router.navigate(button.dataset.path);
      });
    });
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
