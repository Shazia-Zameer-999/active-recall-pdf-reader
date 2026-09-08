window.Pages.Settings = {
  apply(settings) {
    document.documentElement.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
    document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));
  },

  render() {
    const settings = Storage.getSettings();
    this.apply(settings);

    return `
      <div class="page-header">
        <h1>Settings</h1>
        <p class="page-subtitle">Customize your study experience</p>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Active Recall</h3>

        <div class="settings-row">
          <div>
            <label class="settings-label">Enable Active Recall</label>
            <p class="settings-hint">Get quizzed on what you just read while reading a PDF.</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-recall-enabled" ${settings.recallEnabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-row">
          <div>
            <label class="settings-label" for="setting-recall-frequency">Recall frequency</label>
            <p class="settings-hint">Show a question every N pages read.</p>
          </div>
          <input
            type="number"
            id="setting-recall-frequency"
            class="settings-number-input"
            min="1"
            max="50"
            value="${settings.recallFrequencyPages}"
          />
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Study Goals</h3>

        <div class="settings-row">
          <div>
            <label class="settings-label" for="setting-daily-goal">Daily reading goal (minutes)</label>
            <p class="settings-hint">Used for tracking your daily study streak.</p>
          </div>
          <input
            type="number"
            id="setting-daily-goal"
            class="settings-number-input"
            min="5"
            max="480"
            value="${settings.dailyGoalMinutes}"
          />
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Accessibility</h3>

        <div class="settings-row">
          <div>
            <label class="settings-label" for="setting-font-size">Reading font size</label>
            <p class="settings-hint">Applies to Notes and other text content.</p>
          </div>
          <div class="settings-slider-group">
            <input
              type="range"
              id="setting-font-size"
              min="12"
              max="24"
              value="${settings.fontSize}"
            />
            <span id="font-size-value">${settings.fontSize}px</span>
          </div>
        </div>

        <div class="settings-row">
          <div>
            <label class="settings-label">High contrast mode</label>
            <p class="settings-hint">Increases contrast for better readability.</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-high-contrast" ${settings.highContrast ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-actions">
        <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
        <span id="settings-save-status" class="settings-save-status"></span>
      </div>
    `;
  },

  afterRender() {
    const fontSizeInput = document.getElementById('setting-font-size');
    const fontSizeValue = document.getElementById('font-size-value');

    fontSizeInput.addEventListener('input', (e) => {
      fontSizeValue.textContent = `${e.target.value}px`;
    });

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
      const saveButton = document.getElementById('save-settings-btn');
      const statusEl = document.getElementById('settings-save-status');
      const newSettings = {
        recallEnabled: document.getElementById('setting-recall-enabled').checked,
        recallFrequencyPages: parseInt(document.getElementById('setting-recall-frequency').value, 10) || 5,
        dailyGoalMinutes: parseInt(document.getElementById('setting-daily-goal').value, 10) || 30,
        fontSize: parseInt(document.getElementById('setting-font-size').value, 10) || 16,
        highContrast: document.getElementById('setting-high-contrast').checked,
      };

      Storage.saveSettings(newSettings);
      this.apply(newSettings);
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        await DataSync.flush();
        statusEl.textContent = 'Saved to your account';
        statusEl.classList.add('settings-save-status-visible');
      } catch (error) {
        statusEl.textContent = `Could not save: ${error.message}`;
        statusEl.classList.add('settings-save-status-visible');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Settings';
      }

      setTimeout(() => {
        statusEl.classList.remove('settings-save-status-visible');
      }, 2000);
    });
  },
};
