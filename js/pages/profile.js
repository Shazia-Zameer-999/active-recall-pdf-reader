window.Pages.Profile = {
  render() {
    return `
      <div class="page-header">
        <h1>Profile</h1>
        <p class="page-subtitle">Your account, study workspace, and security</p>
      </div>

      <div id="profile-content"></div>
    `;
  },

  async afterRender() {
    await this.renderProfile();
  },

  async renderProfile() {
    const content = document.getElementById('profile-content');
    const profile = Storage.getProfile();
    const pdfs = await DB.getAllPDFs();
    const flashcards = Storage.getFlashcards();
    const quizHistory = Storage.getQuizHistory();
    const notes = Storage.getNotes();

    const avatars = ['🧑‍🎓', '📚', '🧠', '✨', '🦉', '🐢', '🌱', '🔥'];
    const currentAvatar = profile.avatar || '🧑‍🎓';

    const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    content.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar-picker">
          ${avatars
            .map(
              (a) => `
            <button class="avatar-option ${a === currentAvatar ? 'avatar-selected' : ''}" data-avatar="${a}">${a}</button>
          `
            )
            .join('')}
        </div>

        <label class="settings-label" for="profile-name-input">Name</label>
        <input type="text" id="profile-name-input" class="manual-form-input" value="${profile.name || ''}" placeholder="Your name" />

        <p class="profile-member-since">Member since ${joinDate}</p>

        <button id="profile-save-btn" class="btn btn-primary">Save Profile</button>
        <span id="profile-save-status" class="settings-save-status"></span>
      </div>

      <div class="dashboard-stats-grid" style="margin-top: var(--space-lg);">
        <div class="stat-card">
          <span class="stat-icon">📚</span>
          <p class="stat-value">${pdfs.length}</p>
          <p class="stat-label">PDFs Uploaded</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🗂️</span>
          <p class="stat-value">${flashcards.length}</p>
          <p class="stat-label">Flashcards Made</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">❓</span>
          <p class="stat-value">${quizHistory.length}</p>
          <p class="stat-label">Quizzes Taken</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📝</span>
          <p class="stat-value">${notes.length}</p>
          <p class="stat-label">Notes Written</p>
        </div>
      </div>

      <div class="danger-zone">
        <h3 class="danger-zone-title">Danger Zone</h3>
        <p class="settings-hint">Permanently delete all your PDFs, notes, flashcards, quizzes, and settings. This cannot be undone.</p>
        <button id="reset-data-btn" class="btn btn-danger">Reset All Data</button>
      </div>

      <div class="settings-section profile-security-section">
        <h3 class="settings-section-title">Account security</h3>
        <form id="change-password-form" class="profile-security-form">
          <input id="current-password-input" class="manual-form-input" type="password" placeholder="Current password" autocomplete="current-password" required />
          <input id="new-password-input" class="manual-form-input" type="password" placeholder="New password (8+ characters)" minlength="8" autocomplete="new-password" required />
          <input id="confirm-password-input" class="manual-form-input" type="password" placeholder="Confirm new password" minlength="8" autocomplete="new-password" required />
          <button class="btn btn-secondary-sm" type="submit">Change password</button>
          <span id="password-save-status" class="settings-save-status" role="status"></span>
        </form>
        <button id="delete-account-btn" class="btn btn-danger profile-delete-account">Delete account</button>
      </div>
    `;

    let selectedAvatar = currentAvatar;
    content.querySelectorAll('.avatar-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('avatar-selected'));
        btn.classList.add('avatar-selected');
        selectedAvatar = btn.getAttribute('data-avatar');
      });
    });

    document.getElementById('profile-save-btn').addEventListener('click', () => {
      const name = document.getElementById('profile-name-input').value.trim() || 'Student';

      Storage.saveProfile({
        ...profile,
        name,
        avatar: selectedAvatar,
      });

      const statusEl = document.getElementById('profile-save-status');
      statusEl.textContent = '✓ Saved';
      statusEl.classList.add('settings-save-status-visible');
      setTimeout(() => statusEl.classList.remove('settings-save-status-visible'), 2000);
    });

    document.getElementById('reset-data-btn').addEventListener('click', async () => {
      const confirmed = confirm(
        'This will permanently delete ALL your PDFs, notes, flashcards, quizzes, bookmarks, and settings. This cannot be undone.\n\nAre you absolutely sure?'
      );
      if (!confirmed) return;

      const doubleConfirmed = confirm('Really sure? This is your last chance to cancel.');
      if (!doubleConfirmed) return;

      await DataSync.clear();
      await DB.deleteAllPDFs();

      alert('All data has been reset.');
      Router.navigate('/');
    });

    document.getElementById('change-password-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const newPassword = document.getElementById('new-password-input').value;
      const confirmPassword = document.getElementById('confirm-password-input').value;
      const statusEl = document.getElementById('password-save-status');
      if (newPassword !== confirmPassword) {
        statusEl.textContent = 'Passwords do not match';
        statusEl.classList.add('settings-save-status-visible');
        return;
      }

      try {
        await Auth.request('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: document.getElementById('current-password-input').value,
            newPassword,
          }),
        });
        statusEl.textContent = 'Password updated';
        statusEl.classList.add('settings-save-status-visible');
        event.target.reset();
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add('settings-save-status-visible');
      }
    });

    document.getElementById('delete-account-btn').addEventListener('click', async () => {
      const confirmed = confirm('Delete your account and all stored study data? This cannot be undone.');
      if (!confirmed) return;
      try {
        await Auth.request('/api/auth/account', { method: 'DELETE' });
        Auth.user = null;
        DataSync.enabled = false;
        Storage.clearUserData();
        Router.navigate('/');
      } catch (error) {
        alert(error.message);
      }
    });
  },
};
