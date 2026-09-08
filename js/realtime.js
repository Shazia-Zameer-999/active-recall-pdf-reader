const Realtime = {
    socket: null,
    currentGroupId: null,
    listeners: new Map(),

    connect() {
        if (this.socket || typeof io === 'undefined' || !Auth.user) return;
        this.socket = io({ transports: ['websocket', 'polling'] });
        this.socket.on('connect_error', (error) => console.error('Realtime connection failed:', error.message));
    },

    on(event, callback) {
        if (!this.socket) this.connect();
        if (!this.socket) return;
        this.socket.on(event, callback);
        this.listeners.set(`${event}:${callback}`, true);
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

    studyStarted(pdfId, currentPage) {
        if (this.socket) this.socket.emit('study_started', { pdfId, currentPage });
    },

    studyUpdated(currentPage) {
        if (this.socket) this.socket.emit('study_updated', { currentPage });
    },

    studyStopped() {
        if (this.socket) this.socket.emit('study_stopped');
    },

    readMessage(messageId) {
        if (this.socket) this.socket.emit('read_message', { messageId });
    },

    typing(groupId, isTyping) {
        if (this.socket) this.socket.emit('typing', { groupId, isTyping });
    },
};