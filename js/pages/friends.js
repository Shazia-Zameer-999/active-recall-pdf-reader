window.Pages.Friends = {
    render() {
        return `
      <div class="page-header">
        <h1>Friends</h1>
        <p class="page-subtitle">Study with people you know.</p>
      </div>
      <section class="friends-section">
        <form id="friend-search-form" class="friend-search-form">
          <input id="friend-search-input" class="manual-form-input" type="search" minlength="2" placeholder="Search by name or email" aria-label="Search users" />
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <div id="friend-search-results" class="friends-list"></div>
      </section>
      <div class="friends-columns">
        <section class="friends-section">
          <h2>Friend requests</h2>
          <div id="friend-requests-list" class="friends-list"></div>
        </section>
        <section class="friends-section">
          <h2>Your friends</h2>
          <div id="friends-list" class="friends-list"></div>
        </section>
      </div>
    `;
    },

    async afterRender() {
        document.getElementById('friend-search-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const query = document.getElementById('friend-search-input').value.trim();
            const results = document.getElementById('friend-search-results');
            if (query.length < 2) {
                results.innerHTML = '<p class="friends-empty">Enter at least two characters.</p>';
                return;
            }
            try {
                const data = await Auth.request(`/api/users/search?q=${encodeURIComponent(query)}`);
                results.innerHTML = data.users.length
                    ? data.users.map((user) => this.renderUser(user, true)).join('')
                    : '<p class="friends-empty">No users found.</p>';
                this.attachSearchActions();
            } catch (error) {
                results.innerHTML = `<p class="friends-error">${this.escapeHtml(error.message)}</p>`;
            }
        });

        await this.loadLists();
    },

    async loadLists() {
        const [friends, requests] = await Promise.all([
            Auth.request('/api/friends'),
            Auth.request('/api/friends/requests'),
        ]);
        document.getElementById('friends-list').innerHTML = friends.friends.length
            ? friends.friends.map((entry) => this.renderUser(entry.user, false)).join('')
            : '<p class="friends-empty">No friends yet.</p>';
        document.getElementById('friend-requests-list').innerHTML = requests.requests.length
            ? requests.requests.map((entry) => this.renderRequest(entry)).join('')
            : '<p class="friends-empty">No pending requests.</p>';
        this.attachListActions();
    },

    renderUser(user, searchable) {
        return `
      <div class="friend-item">
        <span class="friend-avatar">${this.escapeHtml(user.avatar || '🧑‍🎓')}</span>
        <div class="friend-info">
          <strong>${this.escapeHtml(user.name)}</strong>
          <span>${this.escapeHtml(user.email)}</span>
        </div>
        ${searchable ? `<button class="btn btn-secondary-sm send-friend-btn" data-user-id="${user.id}">Add friend</button>` : `<button class="btn btn-secondary-sm remove-friend-btn" data-user-id="${user.id}">Remove</button>`}
      </div>
    `;
    },

    renderRequest(entry) {
        return `
      <div class="friend-item">
        <span class="friend-avatar">${this.escapeHtml(entry.user.avatar || '🧑‍🎓')}</span>
        <div class="friend-info">
          <strong>${this.escapeHtml(entry.user.name)}</strong>
          <span>${this.escapeHtml(entry.user.email)}</span>
        </div>
        <button class="btn btn-primary accept-friend-btn" data-request-id="${entry.id}">Accept</button>
        <button class="btn btn-secondary-sm reject-friend-btn" data-request-id="${entry.id}">Reject</button>
      </div>
    `;
    },

    attachSearchActions() {
        document.querySelectorAll('.send-friend-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    await Auth.request('/api/friends/requests', {
                        method: 'POST',
                        body: JSON.stringify({ userId: button.dataset.userId }),
                    });
                    button.textContent = 'Request sent';
                } catch (error) {
                    button.disabled = false;
                    button.textContent = error.message;
                }
            });
        });
    },

    attachListActions() {
        document.querySelectorAll('.accept-friend-btn, .reject-friend-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.classList.contains('accept-friend-btn') ? 'accept' : 'reject';
                await Auth.request(`/api/friends/requests/${button.dataset.requestId}/${action}`, { method: 'POST' });
                await this.loadLists();
            });
        });
        document.querySelectorAll('.remove-friend-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                await Auth.request(`/api/friends/${button.dataset.userId}`, { method: 'DELETE' });
                await this.loadLists();
            });
        });
    },

    escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[character]));
    },
};
