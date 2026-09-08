const Notifications = {
    items: [],

    async init() {
        if (!Auth.user) return;
        Realtime.on('notification_created', (notification) => {
            this.items.unshift(notification);
            this.render();
        });
        try {
            const data = await Auth.request('/api/notifications');
            this.items = data.notifications || [];
            this.render();
        } catch (error) {
            console.error('Notifications loading failed:', error);
        }
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
                ? this.items.slice(0, 10).map((item) => `<p class="notification-item ${item.readAt ? '' : 'unread'}">${this.escapeHtml(item.type.replaceAll('_', ' '))}</p>`).join('')
                : '<p class="notification-empty">No notifications</p>';
        }
    },

    toggle() {
        document.getElementById('notification-popover')?.classList.toggle('is-open');
    },

    escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
        }[character]));
    },
};
