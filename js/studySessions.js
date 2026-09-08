const StudySessions = {
    activeId: null,

    async start(pdfId, currentPage = 1, groupId = null) {
        const data = await Auth.request('/api/study-sessions', {
            method: 'POST',
            body: JSON.stringify({ pdfId, currentPage, groupId }),
        });
        this.activeId = data.session.id;
        return data.session;
    },

    async update(currentPage) {
        if (!this.activeId) return;
        await Auth.request(`/api/study-sessions/${this.activeId}`, {
            method: 'PUT',
            body: JSON.stringify({ currentPage }),
        });
    },

    async finish() {
        if (!this.activeId) return;
        const sessionId = this.activeId;
        this.activeId = null;
        try {
            return await Auth.request(`/api/study-sessions/${sessionId}/finish`, { method: 'POST' });
        } catch (error) {
            console.error('Study session finish failed:', error);
            return null;
        }
    },

    async pause() {
        if (!this.activeId) return;
        await Auth.request(`/api/study-sessions/${this.activeId}/pause`, { method: 'POST' });
    },

    async resume() {
        if (!this.activeId) return;
        await Auth.request(`/api/study-sessions/${this.activeId}/resume`, { method: 'POST' });
    },
};
