const Storage = {
  KEYS: {
    NOTES: 'recall_notes',
    FLASHCARDS: 'recall_flashcards',
    QUIZ_HISTORY: 'recall_quiz_history',
    BOOKMARKS: 'recall_bookmarks',
    RECALL_SESSIONS: 'recall_sessions',
    SETTINGS: 'recall_settings',
    PROFILE: 'recall_profile',
    READING_HISTORY: 'recall_reading_history',
    OCR_CACHE: 'recall_ocr_cache',
    ANNOTATIONS: 'recall_annotations',
  },

  _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error(`Storage read failed for ${key}:`, error);
      return fallback;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage write failed for ${key}:`, error);
      return false;
    }
  },

  getNotes() { return this._get(this.KEYS.NOTES, []); },
  saveNote(note) {
    const notes = this.getNotes();
    const i = notes.findIndex((n) => n.id === note.id);
    if (i >= 0) notes[i] = note; else notes.push(note);
    this._set(this.KEYS.NOTES, notes);
  },
  deleteNote(id) {
    this._set(this.KEYS.NOTES, this.getNotes().filter((n) => n.id !== id));
  },

  getFlashcards() { return this._get(this.KEYS.FLASHCARDS, []); },
  saveFlashcard(card) {
    const cards = this.getFlashcards();
    const i = cards.findIndex((c) => c.id === card.id);
    if (i >= 0) cards[i] = card; else cards.push(card);
    this._set(this.KEYS.FLASHCARDS, cards);
  },
  saveFlashcards(cardsArray) {
    this._set(this.KEYS.FLASHCARDS, [...this.getFlashcards(), ...cardsArray]);
  },
  deleteFlashcard(id) {
    this._set(this.KEYS.FLASHCARDS, this.getFlashcards().filter((c) => c.id !== id));
  },

  getQuizHistory() { return this._get(this.KEYS.QUIZ_HISTORY, []); },
  saveQuizResult(result) {
    const history = this.getQuizHistory();
    history.push(result);
    this._set(this.KEYS.QUIZ_HISTORY, history);
  },

  getBookmarks() { return this._get(this.KEYS.BOOKMARKS, []); },
  saveBookmark(bookmark) {
    const bookmarks = this.getBookmarks();
    bookmarks.push(bookmark);
    this._set(this.KEYS.BOOKMARKS, bookmarks);
  },
  deleteBookmark(id) {
    this._set(this.KEYS.BOOKMARKS, this.getBookmarks().filter((b) => b.id !== id));
  },

  getRecallSessions() { return this._get(this.KEYS.RECALL_SESSIONS, []); },
  saveRecallSession(session) {
    const sessions = this.getRecallSessions();
    sessions.push(session);
    this._set(this.KEYS.RECALL_SESSIONS, sessions);
  },

  getSettings() {
    return this._get(this.KEYS.SETTINGS, {
      recallFrequencyPages: 5,
      recallEnabled: true,
      dailyGoalMinutes: 30,
      fontSize: 16,
      highContrast: false,
    });
  },
  saveSettings(settings) { this._set(this.KEYS.SETTINGS, settings); },

  getProfile() {
    return this._get(this.KEYS.PROFILE, { name: 'Student', createdAt: Date.now() });
  },
  saveProfile(profile) { this._set(this.KEYS.PROFILE, profile); },

  getReadingHistory() { return this._get(this.KEYS.READING_HISTORY, []); },
  updateReadingProgress(pdfId, currentPage, totalPages) {
    const history = this.getReadingHistory();
    const existing = history.find((h) => h.pdfId === pdfId);
    const now = Date.now();
    if (existing) {
      existing.currentPage = currentPage;
      existing.totalPages = totalPages;
      existing.lastReadAt = now;
    } else {
      history.push({ pdfId, currentPage, totalPages, lastReadAt: now, startedAt: now });
    }
    this._set(this.KEYS.READING_HISTORY, history);
  },

  // --- OCR text cache (avoids re-running OCR on the same page repeatedly) ---
  getOcrCache() {
    return this._get(this.KEYS.OCR_CACHE, {});
  },
  getCachedOcrText(pdfId, pageNumber) {
    const cache = this.getOcrCache();
    return cache[`${pdfId}_${pageNumber}`] || null;
  },
  setCachedOcrText(pdfId, pageNumber, text) {
    const cache = this.getOcrCache();
    cache[`${pdfId}_${pageNumber}`] = text;
    this._set(this.KEYS.OCR_CACHE, cache);
  },

  // --- Annotations: { [pdfId]: { [pageNumber]: [annotation, ...] } } ---
  getAnnotationsStore() {
    return this._get(this.KEYS.ANNOTATIONS, {});
  },
  getPageAnnotations(pdfId, pageNumber) {
    const store = this.getAnnotationsStore();
    return (store[pdfId] && store[pdfId][pageNumber]) || [];
  },
  addAnnotation(pdfId, pageNumber, annotation) {
    const store = this.getAnnotationsStore();
    if (!store[pdfId]) store[pdfId] = {};
    if (!store[pdfId][pageNumber]) store[pdfId][pageNumber] = [];
    store[pdfId][pageNumber].push(annotation);
    this._set(this.KEYS.ANNOTATIONS, store);
  },
  deleteAnnotation(pdfId, pageNumber, annotationId) {
    const store = this.getAnnotationsStore();
    if (store[pdfId] && store[pdfId][pageNumber]) {
      store[pdfId][pageNumber] = store[pdfId][pageNumber].filter((a) => a.id !== annotationId);
      this._set(this.KEYS.ANNOTATIONS, store);
    }
  },
  getAllAnnotationsForPdf(pdfId) {
    const store = this.getAnnotationsStore();
    const pdfAnnotations = store[pdfId] || {};
    const flat = [];
    Object.keys(pdfAnnotations).forEach((pageNum) => {
      pdfAnnotations[pageNum].forEach((a) => flat.push({ ...a, pageNumber: parseInt(pageNum, 10) }));
    });
    return flat.sort((a, b) => a.pageNumber - b.pageNumber);
  },

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  },
};