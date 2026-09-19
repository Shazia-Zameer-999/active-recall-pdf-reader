const Realtime = {
    socket: null,
    currentGroupId: null,
    activeStudy: null,
    listeners: new Map(),
    _connecting: false,
    _scriptPromise: null,

    // Lazily injects the Socket.IO client from the CDN the first time it's needed, and only once.
    // Same-origin behavior is untouched — this only controls WHEN the script loads,
    // not what URL the socket connects to (that's still io({...}) below, no URL argument).
    loadSocketIoScript() {
        if (typeof io !== 'undefined') return Promise.resolve();
        if (this._scriptPromise) return this._scriptPromise;

        this._scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
            script.onload = () => resolve();
            script.onerror = () => {
                this._scriptPromise = null;
                reject(new Error('Failed to load Socket.IO from CDN'));
            };
            document.head.appendChild(script);
        });

        return this._scriptPromise;
    },

    async connect() {
        if (this.socket || this._connecting || !Auth.user) return;
        this._connecting = true;
        try {
            await this.loadSocketIoScript();
        } catch (error) {
            console.error('Realtime connection failed to load:', error.message);
            return;
        } finally {
            this._connecting = false;
        }
        if (this.socket || typeof io === 'undefined') return;

        this.socket = io({ transports: ['websocket', 'polling'] });
        this.socket.on('connect', () => {
            Notifications.refresh();
            if (this.currentGroupId) this.socket.emit('join_group', { groupId: this.currentGroupId });
            if (this.activeStudy) this.socket.emit('study_started', this.activeStudy);
        });
        this.socket.on('connect_error', (error) => console.error('Realtime connection failed:', error.message));

        // Re-bind any listeners that were registered via on() before the socket existed yet
        for (const [, listener] of this.listeners) {
            this.socket.on(listener.event, listener.callback);
        }
    },

    disconnect() {
        if (this.socket) this.socket.disconnect();
        this.socket = null;
        this.currentGroupId = null;
        this.activeStudy = null;
        this.listeners.clear();
    },

    on(event, callback, scope = 'global') {
        this.listeners.set(`${scope}:${event}:${callback}`, { event, callback, scope });
        if (this.socket) {
            this.socket.on(event, callback);
        } else {
            this.connect();
        }
    },

    offScope(scope) {
        for (const [key, listener] of this.listeners) {
            if (listener.scope !== scope) continue;
            this.socket?.off(listener.event, listener.callback);
            this.listeners.delete(key);
        }
    },

    joinGroup(groupId) {
        this.currentGroupId = groupId;
        if (this.socket) {
            this.socket.emit('join_group', { groupId });
        } else {
            this.connect();
        }
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