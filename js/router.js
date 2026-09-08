const routes = {
  '/': window.Pages.Landing,
  '/dashboard': window.Pages.Dashboard,
  '/library': window.Pages.Library,
  '/reader': window.Pages.Reader,
  '/notes': window.Pages.Notes,
  '/flashcards': window.Pages.Flashcards,
  '/quiz': window.Pages.Quiz,
  '/analytics': window.Pages.Analytics,
  '/settings': window.Pages.Settings,
  '/profile': window.Pages.Profile,
};

const Router = {
  init() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  },

  // Returns just the path part, e.g. "#/reader?id=abc123" -> "/reader"
  getCurrentPath() {
    const hash = window.location.hash.replace('#', '');
    if (hash && !hash.startsWith('/')) return '/';
    const path = hash.split('?')[0];
    return path || '/';
  },

  // Returns a specific query param value, e.g. Router.getQueryParam('id')
  getQueryParam(key) {
    const hash = window.location.hash.replace('#', '');
    const queryString = hash.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    return params.get(key);
  },

  render() {
    const path = this.getCurrentPath();
    const page = routes[path];
    const app = document.getElementById('app');

    if (path !== '/' && !Auth.user) {
      window.location.hash = '/';
      return;
    }

    if (!page) {
      app.innerHTML = `<div class="page-error"><h2>404 — Page not found</h2></div>`;
      return;
    }

    if (path === '/') {
      app.innerHTML = page.render();
    } else {
      app.innerHTML = Layout.render(page.render(), path);
    }

    if (typeof page.afterRender === 'function') {
      page.afterRender();
    }
    if (path !== '/') {
      Layout.afterRender();
    }
  },

  navigate(path) {
    window.location.hash = path;
  },
};
