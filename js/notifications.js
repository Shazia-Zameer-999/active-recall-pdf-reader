const Notifications = {
    items: [],
    initialized: false,

    async init() {
        if (!Auth.user) return;
        if (this.initialized) return;
        this.initialized = true;
        Realtime.on('notification_created', (notification) => {
            this.items.unshift(notification);
            this.render();
        });
        await this.refresh();
    },

    async refresh() {
        if (!Auth.user) return;
        try {
            const data = await Auth.request('/api/notifications');
            this.items = data.notifications || [];
            this.render();
        } catch (error) {
            console.error('Notifications loading failed:', error);
        }
    },

    reset() {
        this.items = [];
        this.initialized = false;
        this.render();
    },

    render() {
        const badge = document.getElementById('notification-badge');
        const list = document.getElementById('notification-list');
        if (badge) {
            const unread = this.items.filter((item) => !item.readAt).length;
            badge.textContent = unread ? String(unread) : '';
            badge.hidden = !unread;
        }
        if (list) {
            list.innerHTML = this.items.length
                ? this.items.slice(0, 10).map((item) => `<button type="button" class="notification-item ${item.readAt ? '' : 'unread'}" data-notification-id="${item.id}">${this.escapeHtml(item.type.replaceAll('_', ' '))}</button>`).join('')
                : '<p class="notification-empty">No notifications</p>';
        }
    },

    toggle() {
        const popover = document.getElementById('notification-popover');
        popover?.classList.toggle('is-open');
        if (popover?.classList.contains('is-open')) this.attachReadHandlers();
    },

    attachReadHandlers() {
        document.querySelectorAll('[data-notification-id]').forEach((item) => {
            if (item.dataset.readHandler) return;
            item.dataset.readHandler = 'true';
            item.addEventListener('click', async () => {
                const notification = this.items.find((entry) => entry.id === item.dataset.notificationId);
                if (!notification || notification.readAt) return;
                await Auth.request(`/api/notifications/${notification.id}/read`, { method: 'POST' });
                notification.readAt = new Date().toISOString();
                this.render();
                this.attachReadHandlers();
            });
        });
    },

    escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[character]));
    },
};
