const Theme = {
  KEY: 'recall_theme',

  init() {
    const saved = localStorage.getItem(this.KEY) || 'light';
    document.body.setAttribute('data-theme', saved);
  },

  toggle() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem(this.KEY, next);
  },

  current() {
    return document.body.getAttribute('data-theme');
  },
};