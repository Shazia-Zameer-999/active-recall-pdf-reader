document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();

  try {
    await DB.init();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  Router.init();
});