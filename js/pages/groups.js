window.Pages.Groups = {
    render() {
        const groupId = Router.getQueryParam('id');
        if (groupId) return this.renderDetailShell(groupId);
        return `
      <div class="page-header">
        <h1>Study Groups</h1>
        <p class="page-subtitle">Find your people and study together.</p>
      </div>
      <section class="groups-section">
        <h2>Create a group</h2>
        <form id="create-group-form" class="group-form">
          <input id="group-name" class="manual-form-input" required maxlength="80" placeholder="Group name" />
          <textarea id="group-description" class="manual-form-input" maxlength="500" rows="2" placeholder="What are you studying?"></textarea>
          <button class="btn btn-primary" type="submit">Create group</button>
          <p id="group-create-status" class="groups-status" role="status"></p>
        </form>
      </section>
      <section class="groups-section">
        <div class="groups-heading-row"><h2>Available groups</h2><button id="refresh-groups-btn" class="btn btn-secondary-sm" type="button">Refresh</button></div>
        <div id="groups-list" class="groups-grid"></div>
      </section>
    `;
    },

    async afterRender() {
        const groupId = Router.getQueryParam('id');
        if (groupId) {
            await this.loadDetail(groupId);
            return;
        }
        document.getElementById('create-group-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const status = document.getElementById('group-create-status');
            try {
                await Auth.request('/api/groups', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: document.getElementById('group-name').value.trim(),
                        description: document.getElementById('group-description').value.trim(),
                    }),
                });
                event.target.reset();
                status.textContent = 'Group created';
                await this.loadGroups();
            } catch (error) {
                status.textContent = error.message;
            }
        });
        document.getElementById('refresh-groups-btn').addEventListener('click', () => this.loadGroups());
        await this.loadGroups();
    },

    renderDetailShell(groupId) {
        return `
      <div class="page-header"><a href="#/groups" class="btn btn-secondary-sm">← Groups</a><h1 id="group-detail-title">Study Group</h1></div>
      <div class="groups-columns">
        <section class="groups-section"><h2>Live study presence</h2><div id="group-presence-list" class="groups-list"></div><div id="group-members-list" class="groups-list"></div></section>
        <section class="groups-section"><h2>Group chat</h2><div id="group-chat-list" class="group-chat-list"></div><form id="group-chat-form" class="group-form"><input id="group-chat-input" class="manual-form-input" maxlength="2000" placeholder="Write a message..." autocomplete="off" /><input id="group-attachment-input" type="file" accept="image/*,.pdf" /><button class="btn btn-primary" type="submit">Send</button><span id="group-typing-status" class="groups-status"></span></form></section>
      </div>
    `;
    },

    async loadDetail(groupId) {
        const data = await Auth.request(`/api/groups/${groupId}`);
        document.getElementById('group-detail-title').textContent = data.group.name;
        document.getElementById('group-members-list').innerHTML = data.group.members.map((member) => `<p>${this.escapeHtml(member.user.avatar || '🧑‍🎓')} ${this.escapeHtml(member.user.name)} <small>${this.escapeHtml(member.role)}</small></p>`).join('');
        const messages = await Auth.request(`/api/groups/${groupId}/messages`);
        this.renderMessages(messages.messages);
        Realtime.joinGroup(groupId);
        Realtime.on('presence_snapshot', (presence) => {
            document.getElementById('group-presence-list').innerHTML = presence.members.map((member) => `<p>🟢 ${this.escapeHtml(member.name)} ${member.pdfId ? `· page ${member.currentPage}` : ''}</p>`).join('');
        });
        Realtime.on('presence_updated', (member) => {
            const list = document.getElementById('group-presence-list');
            if (list && !list.textContent.includes(member.name)) list.insertAdjacentHTML('beforeend', `<p>🟢 ${this.escapeHtml(member.name)} · page ${member.currentPage}</p>`);
        });
        Realtime.on('message_created', (message) => this.renderMessages([...this.currentMessages || [], message]));
        Realtime.on('message_read', (receipt) => {
            const message = (this.currentMessages || []).find((item) => item.id === receipt.messageId);
            if (message) message.readAt = receipt.readAt;
            this.renderMessages(this.currentMessages || []);
        });
        Realtime.on('typing', (typing) => {
            const status = document.getElementById('group-typing-status');
            if (status) status.textContent = typing.isTyping ? `${typing.name} is typing...` : '';
        });
        const chatInput = document.getElementById('group-chat-input');
        let typingTimer;
        chatInput.addEventListener('input', () => {
            Realtime.typing(groupId, true);
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => Realtime.typing(groupId, false), 800);
        });
        document.getElementById('group-chat-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = document.getElementById('group-chat-input');
            const body = input.value.trim();
            const attachment = document.getElementById('group-attachment-input').files[0];
            if (!body && !attachment) return;
            let attachments = [];
            if (attachment) {
                const form = new FormData();
                form.append('file', attachment);
                const uploaded = await Auth.request(`/api/groups/${groupId}/attachments`, { method: 'POST', body: form });
                attachments = [uploaded.attachment];
            }
            await Auth.request(`/api/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify({ body, attachments }) });
            input.value = '';
            document.getElementById('group-attachment-input').value = '';
        });
    },

    renderMessages(messages) {
        this.currentMessages = [...new Map(messages.map((message) => [message.id, message])).values()];
        const list = document.getElementById('group-chat-list');
        if (!list) return;
        list.innerHTML = this.currentMessages.map((message) => {
            const attachments = (message.attachments || []).map((attachment) => `<a href="/api/group-attachments/${encodeURIComponent(attachment.id)}" target="_blank" rel="noopener">📎 ${this.escapeHtml(attachment.name || 'Attachment')}</a>`).join(' ');
            return `<p data-message-id="${message.id}"><strong>${this.escapeHtml(message.sender?.name || 'Student')}</strong>${message.body ? `: ${this.escapeHtml(message.body)}` : ''}${attachments ? `<br>${attachments}` : ''}${message.readAt ? ' ✓' : ''}</p>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
        list.querySelectorAll('[data-message-id]').forEach((message) => {
            message.addEventListener('click', () => Realtime.readMessage(message.dataset.messageId));
        });
    },

    async loadGroups() {
        const list = document.getElementById('groups-list');
        list.innerHTML = '<p class="groups-empty">Loading groups...</p>';
        try {
            const data = await Auth.request('/api/groups');
            list.innerHTML = data.groups.length
                ? data.groups.map((group) => this.renderGroup(group)).join('')
                : '<p class="groups-empty">No groups yet. Create the first one.</p>';
            this.attachActions();
        } catch (error) {
            list.innerHTML = `<p class="groups-error">${this.escapeHtml(error.message)}</p>`;
        }
    },

    renderGroup(group) {
        return `
      <article class="group-card">
        <h3>${this.escapeHtml(group.name)}</h3>
        <p>${this.escapeHtml(group.description || 'No description yet.')}</p>
        <span class="group-member-count">${group.memberCount} member${group.memberCount === 1 ? '' : 's'}</span>
        <a class="btn btn-secondary-sm" href="#/groups?id=${group.id}">Open group</a>
        <button class="btn ${group.joined ? 'btn-secondary-sm' : 'btn-primary'} group-action-btn" data-group-id="${group.id}" data-joined="${group.joined}">${group.joined ? 'Leave group' : 'Join group'}</button>
      </article>
    `;
    },

    attachActions() {
        document.querySelectorAll('.group-action-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.dataset.joined === 'true' ? 'leave' : 'join';
                button.disabled = true;
                try {
                    await Auth.request(`/api/groups/${button.dataset.groupId}/${action}`, { method: 'POST' });
                    await this.loadGroups();
                } catch (error) {
                    button.disabled = false;
                    button.textContent = error.message;
                }
            });
        });
    },

    escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[character]));
    },
};
