const Realtime = {
    socket: null,
    currentGroupId: null,
    activeStudy: null,
    listeners: new Map(),

    connect() {
        if (this.socket || typeof io === 'undefined' || !Auth.user) return;
        this.socket = io({ transports: ['websocket', 'polling'] });
        this.socket.on('connect', () => {
            Notifications.refresh();
            if (this.currentGroupId) this.socket.emit('join_group', { groupId: this.currentGroupId });
            if (this.activeStudy) this.socket.emit('study_started', this.activeStudy);
        });
        this.socket.on('connect_error', (error) => console.error('Realtime connection failed:', error.message));
    },

    disconnect() {
        if (this.socket) this.socket.disconnect();
        this.socket = null;
        this.currentGroupId = null;
        this.activeStudy = null;
        this.listeners.clear();
    },

    on(event, callback, scope = 'global') {
        if (!this.socket) this.connect();
        if (!this.socket) return;
        this.socket.on(event, callback);
        this.listeners.set(`${scope}:${event}:${callback}`, { event, callback, scope });
    },

    offScope(scope) {
        for (const [key, listener] of this.listeners) {
            if (listener.scope !== scope) continue;
            this.socket?.off(listener.event, listener.callback);
            this.listeners.delete(key);
        }
    },

    joinGroup(groupId) {
        this.connect();
        if (!this.socket) return;
        this.currentGroupId = groupId;
        this.socket.emit('join_group', { groupId });
    },

    leaveGroup() {
        if (this.socket && this.currentGroupId) this.socket.emit('leave_group', { groupId: this.currentGroupId });
        this.currentGroupId = null;
    },

    studyStarted(pdfId, currentPage, pdfName = '') {
        this.activeStudy = { pdfId, pdfName, currentPage };
        if (this.socket) this.socket.emit('study_started', this.activeStudy);
    },

    studyUpdated(currentPage) {
        if (this.activeStudy) this.activeStudy.currentPage = currentPage;
        if (this.socket) this.socket.emit('study_updated', { currentPage });
    },

    studyStopped() {
        this.activeStudy = null;
        if (this.socket) this.socket.emit('study_stopped');
    },

    studyPaused() {
        if (this.socket) this.socket.emit('study_paused');
    },

    studyResumed() {
        if (this.socket) this.socket.emit('study_resumed');
    },

    readMessage(messageId) {
        if (this.socket) this.socket.emit('read_message', { messageId });
    },

    typing(groupId, isTyping) {
        if (this.socket) this.socket.emit('typing', { groupId, isTyping });
    },
};