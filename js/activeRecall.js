const ActiveRecall = {
  pagesSinceLastCheck: 0,
  currentPdfId: null,
  isPromptOpen: false,
  recallFrequencyPages: null,
  promptToken: 0,

  // Call this once when a new PDF is opened in the Reader, to reset counters
  init(pdfId) {
    this.currentPdfId = pdfId;
    this.pagesSinceLastCheck = 0;
    this.recallFrequencyPages = null;
    this.promptToken += 1;
  },

  syncSettings(settings) {
    const frequency = Number(settings.recallFrequencyPages) || 5;
    const frequencyChanged = this.recallFrequencyPages !== null
      && this.recallFrequencyPages !== frequency;
    if (frequencyChanged) {
      this.pagesSinceLastCheck = 0;
      this.promptToken += 1;
      if (this.isPromptOpen) this.closeModal();
    }
    this.recallFrequencyPages = frequency;

    if (!settings.recallEnabled) {
      this.pagesSinceLastCheck = 0;
      this.promptToken += 1;
      if (this.isPromptOpen) this.closeModal();
    }
  },

  // Call this every time a page finishes rendering in the Reader
  async onPageRead(pageText, pageNumber) {
    const settings = Storage.getSettings();
    this.syncSettings(settings);

    if (!settings.recallEnabled) return;
    if (this.isPromptOpen) return; // don't stack prompts
    if (!pageText || pageText.trim().length < 40) return; // skip near-empty pages

    this.pagesSinceLastCheck++;

    if (this.pagesSinceLastCheck >= settings.recallFrequencyPages) {
      this.pagesSinceLastCheck = 0;
      await this.showPrompt(pageText, pageNumber);
    }
  },

  async showPrompt(pageText, pageNumber) {
    this.isPromptOpen = true;
    const promptToken = ++this.promptToken;
    this.renderModal('loading');

    try {
      // Reuse the existing flashcard generator, just ask for a single question
      const cards = await Gemini.generateFlashcards(pageText, 1);
      const card = cards[0];

      const currentSettings = Storage.getSettings();
      if (promptToken !== this.promptToken || !currentSettings.recallEnabled) {
        this.closeModal();
        return;
      }

      if (!card || !card.question) {
        throw new Error('No question generated');
      }

      this.renderModal('question', { card, pageText, pageNumber });
    } catch (error) {
      if (promptToken !== this.promptToken || !Storage.getSettings().recallEnabled) {
        this.closeModal();
        return;
      }
      console.error('Active Recall generation failed:', error);

      const friendlyMessage =
        error.message === 'RATE_LIMIT' || error.message === 'Request timed out — Gemini took too long to respond'
          ? 'The AI is briefly busy (free-tier limit). This clears itself within a minute — try again shortly.'
          : 'Something went wrong generating a question.';

      this.renderModal('error', { message: friendlyMessage });
    }
  },

  renderModal(state, data = {}) {
    let existing = document.getElementById('recall-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'recall-modal-overlay';
    overlay.className = 'recall-modal-overlay';

    if (state === 'loading') {
      overlay.innerHTML = `
        <div class="recall-modal">
          <p class="recall-loading">Generating a quick question about what you just read...</p>
        </div>
      `;
    }

    if (state === 'question') {
      overlay.innerHTML = `
        <div class="recall-modal">
          <span class="recall-badge">Active Recall — Page ${data.pageNumber}</span>
          <h3 class="recall-question">${data.card.question}</h3>
          <textarea id="recall-answer-input" class="recall-answer-input" placeholder="Type your answer..." rows="3"></textarea>
          <div class="recall-actions">
            <button id="recall-skip-btn" class="btn btn-secondary-sm">Skip</button>
            <button id="recall-later-btn" class="btn btn-secondary-sm">Review Later</button>
            <button id="recall-submit-btn" class="btn btn-primary">Submit Answer</button>
          </div>
        </div>
      `;
    }

    if (state === 'result') {
      overlay.innerHTML = `
        <div class="recall-modal">
          <span class="recall-badge">Active Recall — Page ${data.pageNumber}</span>
          <h3 class="recall-question">${data.card.question}</h3>

          <div class="recall-result-block">
            <p class="recall-label">Your answer:</p>
            <p class="recall-user-answer">${data.userAnswer || '(left blank)'}</p>
          </div>

          <div class="recall-result-block">
            <p class="recall-label">Correct answer:</p>
            <p class="recall-correct-answer">${data.card.answer}</p>
          </div>

          <div class="recall-source-block">
            <p class="recall-label">From the text you just read:</p>
            <p class="recall-source-text">${data.pageText.slice(0, 400)}${data.pageText.length > 400 ? '...' : ''}</p>
          </div>

          <p class="recall-self-check">Did you get it right?</p>
          <div class="recall-actions">
            <button id="recall-wrong-btn" class="btn btn-secondary-sm">I got it wrong</button>
            <button id="recall-right-btn" class="btn btn-primary">I got it right</button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(overlay);
    this.attachModalListeners(state, data);
  },

  attachModalListeners(state, data) {
    if (state === 'question') {
      document.getElementById('recall-skip-btn').addEventListener('click', () => {
        this.closeModal();
      });

      document.getElementById('recall-later-btn').addEventListener('click', () => {
        Storage.saveRecallSession({
          id: Storage.generateId(),
          date: Date.now(),
          pdfId: this.currentPdfId,
          pageNumber: data.pageNumber,
          question: data.card.question,
          reviewLater: true,
        });
        this.closeModal();
      });

      document.getElementById('recall-submit-btn').addEventListener('click', () => {
        const userAnswer = document.getElementById('recall-answer-input').value.trim();
        this.renderModal('result', { ...data, userAnswer });
      });
    }

    if (state === 'result') {
      document.getElementById('recall-right-btn').addEventListener('click', () => {
        this.saveResult(data, true);
      });

      document.getElementById('recall-wrong-btn').addEventListener('click', () => {
        this.saveResult(data, false);
      });
    }
  },

  saveResult(data, wasCorrect) {
    Storage.saveRecallSession({
      id: Storage.generateId(),
      date: Date.now(),
      pdfId: this.currentPdfId,
      pageNumber: data.pageNumber,
      question: data.card.question,
      correctAnswer: data.card.answer,
      userAnswer: data.userAnswer,
      wasCorrect,
      reviewLater: false,
    });
    this.closeModal();
  },

  closeModal() {
    const overlay = document.getElementById('recall-modal-overlay');
    if (overlay) overlay.remove();
    this.isPromptOpen = false;
    this.promptToken += 1;
  },
};