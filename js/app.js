document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();

  try {
    await DB.init();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  await Auth.init();
  CommandPalette.init();

  Router.init();
});
