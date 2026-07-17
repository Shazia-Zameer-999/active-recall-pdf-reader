window.Pages.Flashcards = {
  state: {
    mode: 'list', // 'list' | 'study' | 'review'
    studyDeck: [],
    studyIndex: 0,
    isFlipped: false,
  },

  render() {
    const dueCount = SpacedRepetition.getDueCards(Storage.getFlashcards()).length;

    return `
      <div class="page-header">
        <h1>Flashcards</h1>
        <p class="page-subtitle">Study with AI-generated or your own flashcards</p>
      </div>

      <div class="flashcards-toolbar">
        <select id="pdf-select" class="settings-number-input flashcards-pdf-select">
          <option value="">Select a PDF to generate from...</option>
        </select>
        <button id="generate-btn" class="btn btn-primary">✨ Generate from PDF</button>
        <button id="add-manual-btn" class="btn btn-secondary-sm">+ Add Card</button>
        <button id="study-mode-btn" class="btn btn-secondary-sm">📖 Shuffle Study</button>
        <button id="review-mode-btn" class="btn btn-primary">
          🔁 Review Due ${dueCount > 0 ? `<span class="due-badge">${dueCount}</span>` : ''}
        </button>
      </div>

      <div id="generate-status"></div>

      <div id="manual-form-container"></div>

      <div id="flashcards-content"></div>
    `;
  },

  async afterRender() {
    await this.populatePdfSelect();
    document.getElementById('generate-btn').addEventListener('click', () => this.generateFromPdf());
    document.getElementById('add-manual-btn').addEventListener('click', () => this.showManualForm());
    document.getElementById('study-mode-btn').addEventListener('click', () => this.enterStudyMode(false));
    document.getElementById('review-mode-btn').addEventListener('click', () => this.enterStudyMode(true));

    this.state.mode = 'list';
    this.renderList();
  },

  async populatePdfSelect() {
    const select = document.getElementById('pdf-select');
    const pdfs = await DB.getAllPDFs();

    pdfs.forEach((pdf) => {
      const option = document.createElement('option');
      option.value = pdf.id;
      option.textContent = pdf.name;
      select.appendChild(option);
    });
  },

  async extractFullPdfText(pdfId, statusEl) {
    const record = await DB.getPDF(pdfId);
    if (!record) throw new Error('PDF not found');

    const arrayBuffer = await record.file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const pagesToScan = Math.min(pdfDoc.numPages, 20);

    for (let i = 1; i <= pagesToScan; i++) {
      statusEl.innerHTML = `<p class="status-info">Reading page ${i} of ${pagesToScan}...</p>`;

      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      let pageText = textContent.items.map((item) => item.str).join(' ');

      if (pageText.trim().length < 40) {
        const cached = Storage.getCachedOcrText(pdfId, i);
        if (cached) {
          pageText = cached;
        } else {
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

          pageText = await OCR.recognizeCanvas(canvas);
          Storage.setCachedOcrText(pdfId, i, pageText);
        }
      }

      fullText += pageText + '\n';
    }

    return fullText;
  },

  async generateFromPdf() {
    const pdfId = document.getElementById('pdf-select').value;
    const statusEl = document.getElementById('generate-status');

    if (!pdfId) {
      statusEl.innerHTML = `<p class="status-error">Please select a PDF first.</p>`;
      return;
    }

    try {
      const fullText = await this.extractFullPdfText(pdfId, statusEl);

      if (fullText.trim().length < 50) {
        statusEl.innerHTML = `<p class="status-error">Couldn't extract enough text from this PDF.</p>`;
        return;
      }

      statusEl.innerHTML = `<p class="status-info">Generating flashcards with AI...</p>`;

      const generated = await Gemini.generateFlashcards(fullText, 10);

      const cardsToSave = generated.map((card) => ({
        id: Storage.generateId(),
        question: card.question,
        answer: card.answer,
        pdfId,
        favorite: false,
        createdAt: Date.now(),
        // Spaced repetition fields — new cards are due immediately
        dueDate: Date.now(),
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
      }));

      Storage.saveFlashcards(cardsToSave);

      statusEl.innerHTML = `<p class="status-success">Generated ${cardsToSave.length} flashcards!</p>`;
      setTimeout(() => { statusEl.innerHTML = ''; }, 2500);

      this.renderList();
      this.refreshDueBadge();
    } catch (error) {
      console.error('Flashcard generation failed:', error);
      statusEl.innerHTML = `<p class="status-error">Generation failed. Please try again.</p>`;
    }
  },

  showManualForm() {
    const container = document.getElementById('manual-form-container');
    container.innerHTML = `
      <div class="manual-card-form">
        <input type="text" id="manual-question" class="manual-form-input" placeholder="Question" />
        <textarea id="manual-answer" class="manual-form-input" placeholder="Answer" rows="2"></textarea>
        <div class="manual-form-actions">
          <button id="manual-cancel-btn" class="btn btn-secondary-sm">Cancel</button>
          <button id="manual-save-btn" class="btn btn-primary">Save Card</button>
        </div>
      </div>
    `;

    document.getElementById('manual-cancel-btn').addEventListener('click', () => {
      container.innerHTML = '';
    });

    document.getElementById('manual-save-btn').addEventListener('click', () => {
      const question = document.getElementById('manual-question').value.trim();
      const answer = document.getElementById('manual-answer').value.trim();

      if (!question || !answer) return;

      Storage.saveFlashcard({
        id: Storage.generateId(),
        question,
        answer,
        pdfId: null,
        favorite: false,
        createdAt: Date.now(),
        dueDate: Date.now(),
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
      });

      container.innerHTML = '';
      this.renderList();
      this.refreshDueBadge();
    });
  },

  renderList() {
    const content = document.getElementById('flashcards-content');
    const cards = Storage.getFlashcards();

    if (cards.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🗂️</span>
          <p>No flashcards yet. Generate some from a PDF or add one manually.</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="flashcards-grid">
        ${cards
          .map(
            (card) => `
          <div class="flashcard-item">
            <button class="flashcard-favorite ${card.favorite ? 'favorited' : ''}" data-id="${card.id}">
              ${card.favorite ? '⭐' : '☆'}
            </button>
            <p class="flashcard-item-question">${card.question}</p>
            <p class="flashcard-item-answer">${card.answer}</p>
            <p class="flashcard-due-label">${this.formatDueLabel(card.dueDate)}</p>
            <button class="flashcard-delete" data-id="${card.id}">🗑️</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    content.querySelectorAll('.flashcard-favorite').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const card = cards.find((c) => c.id === id);
        card.favorite = !card.favorite;
        Storage.saveFlashcard(card);
        this.renderList();
      });
    });

    content.querySelectorAll('.flashcard-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        Storage.deleteFlashcard(id);
        this.renderList();
        this.refreshDueBadge();
      });
    });
  },

  formatDueLabel(dueDate) {
    if (!dueDate) return '🆕 New';
    const now = Date.now();
    if (dueDate <= now) return '🔁 Due now';
    const days = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));
    return `📅 Due in ${days} day${days === 1 ? '' : 's'}`;
  },

  refreshDueBadge() {
    const btn = document.getElementById('review-mode-btn');
    if (!btn) return;
    const dueCount = SpacedRepetition.getDueCards(Storage.getFlashcards()).length;
    btn.innerHTML = `🔁 Review Due ${dueCount > 0 ? `<span class="due-badge">${dueCount}</span>` : ''}`;
  },

  // isReviewMode: true = spaced repetition (only due cards, rating buttons)
  //               false = shuffle study (all cards, simple flip)
  enterStudyMode(isReviewMode) {
    const allCards = Storage.getFlashcards();

    if (allCards.length === 0) {
      alert('No flashcards yet. Generate or add some first.');
      return;
    }

    let deck = isReviewMode ? SpacedRepetition.getDueCards(allCards) : [...allCards];

    if (isReviewMode && deck.length === 0) {
      alert('No cards due for review right now — nice work staying on top of it!');
      return;
    }

    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.state.mode = isReviewMode ? 'review' : 'study';
    this.state.studyDeck = deck;
    this.state.studyIndex = 0;
    this.state.isFlipped = false;
    this.renderStudyMode();
  },

  renderStudyMode() {
    const content = document.getElementById('flashcards-content');
    const { studyDeck, studyIndex, isFlipped, mode } = this.state;
    const card = studyDeck[studyIndex];
    const isReviewMode = mode === 'review';

    content.innerHTML = `
      <div class="study-mode">
        <p class="study-progress">Card ${studyIndex + 1} of ${studyDeck.length} ${isReviewMode ? '— Review Mode' : ''}</p>

        <div id="study-card" class="study-card ${isFlipped ? 'flipped' : ''}">
          <div class="study-card-face study-card-front">
            <p>${card.question}</p>
          </div>
          <div class="study-card-face study-card-back">
            <p>${card.answer}</p>
          </div>
        </div>

        ${
          !isFlipped
            ? `<p class="study-hint">Click the card to reveal the answer</p>`
            : isReviewMode
            ? `
              <p class="study-hint">How well did you know this?</p>
              <div class="rating-buttons">
                <button class="rating-btn rating-again" data-rating="0">Again</button>
                <button class="rating-btn rating-hard" data-rating="1">Hard</button>
                <button class="rating-btn rating-good" data-rating="2">Good</button>
                <button class="rating-btn rating-easy" data-rating="3">Easy</button>
              </div>
            `
            : `<p class="study-hint">Click the card to flip back</p>`
        }

        <div class="study-controls">
          ${!isReviewMode ? `<button id="study-prev-btn" class="btn btn-secondary-sm" ${studyIndex === 0 ? 'disabled' : ''}>◀ Previous</button>` : ''}
          <button id="study-shuffle-btn" class="btn btn-secondary-sm">🔀 Shuffle</button>
          <button id="study-exit-btn" class="btn btn-secondary-sm">Exit</button>
          ${!isReviewMode ? `<button id="study-next-btn" class="btn btn-primary" ${studyIndex === studyDeck.length - 1 ? 'disabled' : ''}>Next ▶</button>` : ''}
        </div>
      </div>
    `;

    document.getElementById('study-card').addEventListener('click', () => {
      this.state.isFlipped = !this.state.isFlipped;
      this.renderStudyMode();
    });

    if (!isReviewMode) {
      const prevBtn = document.getElementById('study-prev-btn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (this.state.studyIndex > 0) {
            this.state.studyIndex--;
            this.state.isFlipped = false;
            this.renderStudyMode();
          }
        });
      }

      document.getElementById('study-next-btn').addEventListener('click', () => {
        if (this.state.studyIndex < this.state.studyDeck.length - 1) {
          this.state.studyIndex++;
          this.state.isFlipped = false;
          this.renderStudyMode();
        }
      });
    } else {
      content.querySelectorAll('.rating-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rating = parseInt(btn.getAttribute('data-rating'), 10);
          const updatedCard = SpacedRepetition.review(card, rating);
          Storage.saveFlashcard(updatedCard);

          if (this.state.studyIndex < this.state.studyDeck.length - 1) {
            this.state.studyIndex++;
            this.state.isFlipped = false;
            this.renderStudyMode();
          } else {
            alert('Review session complete! 🎉');
            this.state.mode = 'list';
            this.renderList();
            this.refreshDueBadge();
          }
        });
      });
    }

    document.getElementById('study-shuffle-btn').addEventListener('click', () => {
      this.enterStudyMode(isReviewMode);
    });

    document.getElementById('study-exit-btn').addEventListener('click', () => {
      this.state.mode = 'list';
      this.renderList();
      this.refreshDueBadge();
    });
  },
};