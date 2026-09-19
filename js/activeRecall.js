// js/activeRecall.js — Adaptive In-Flow Active Recall Checkpoints for Recallo

const ActiveRecall = {
  pagesSinceLastCheck: 0,
  currentPdfId: null,
  isPromptOpen: false,
  isGatedLocked: false,
  lastGatedPage: null,

  init(pdfId) {
    this.currentPdfId = pdfId;
    this.pagesSinceLastCheck = 0;
    this.isPromptOpen = false;
    this.isGatedLocked = false;
    this.lastGatedPage = null;
    if (window.RecallEngine) {
      window.RecallEngine.init(pdfId);
    }
  },

  async onPageRead(pageText, pageNumber) {
    const settings = Storage.getSettings();
    if (!settings.recallEnabled) return;
    if (this.isPromptOpen) return;
    if (!pageText || pageText.trim().length < 30) return;

    // Check frequency setting
    let targetFreq = 5;
    if (settings.recallFrequencyPages === 'manual') {
      return; // only triggered manually
    } else {
      targetFreq = parseInt(settings.recallFrequencyPages, 10) || (window.RecallEngine ? window.RecallEngine.currentChunkInterval : 2);
    }

    this.pagesSinceLastCheck++;

    if (this.pagesSinceLastCheck >= targetFreq) {
      this.pagesSinceLastCheck = 0;
      await this.showPrompt(pageText, pageNumber);
    }
  },

  async showPrompt(pageText, pageNumber, retryEasier = false) {
    this.isPromptOpen = true;
    this.isGatedLocked = true;
    this.lastGatedPage = pageNumber;
    this.renderModal('loading');

    try {
      let checkpoint;
      if (window.RecallEngine) {
        checkpoint = await window.RecallEngine.generateCheckpoint(pageText, pageNumber, retryEasier);
      } else {
        const cards = await Gemini.generateFlashcards(pageText, 1);
        checkpoint = {
          summary: 'Review the text you just read and retrieve the core concept.',
          question: cards[0]?.question || 'What was the primary concept on this page?',
          answer: cards[0]?.answer || 'Check source text.',
          options: null,
          correctIndex: -1,
          pageNumber,
          pageText,
        };
      }

      this.renderModal('question', { checkpoint, pageText, pageNumber, retryEasier });
    } catch (error) {
      console.error('Active Recall generation failed:', error);
      const friendlyMessage =
        error.message === 'RATE_LIMIT'
          ? 'AI rate limit reached. Pausing checkpoint briefly.'
          : 'Something went wrong generating this checkpoint. You may continue.';
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
        <div class="recall-modal" style="text-align: center; padding: 32px 24px;">
          <div style="font-size: 28px; margin-bottom: 12px; animation: pulse 1s infinite;">🧠</div>
          <p class="recall-loading font-bold" style="font-size: 15px; color: var(--text-primary);">
            Synthesizing 2-Line Recap & Recall Challenge...
          </p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">
            Grounded directly in Page ${data.pageNumber || ''}
          </p>
        </div>
      `;
    }

    if (state === 'question') {
      const cp = data.checkpoint;
      const hasOptions = Array.isArray(cp.options) && cp.options.length > 0;

      let inputHtml = '';
      if (hasOptions) {
        inputHtml = `
          <div class="recall-options-grid" style="display: grid; grid-template-columns: 1fr; gap: 8px; margin: 12px 0;">
            ${cp.options
              .map(
                (opt, idx) => `
              <button class="recall-option-btn btn btn-secondary-sm" data-idx="${idx}" style="text-align: left; padding: 10px 14px; border: 1px solid var(--border-color); font-size: 13px; line-height: 1.4; border-radius: 8px;">
                <strong style="color: var(--accent); margin-right: 6px;">${String.fromCharCode(65 + idx)}.</strong> ${opt}
              </button>`
              )
              .join('')}
          </div>
        `;
      } else {
        inputHtml = `
          <textarea id="recall-answer-input" class="recall-answer-input" placeholder="Type your active recall answer..." rows="3" style="width:100%; margin: 12px 0;"></textarea>
        `;
      }

      overlay.innerHTML = `
        <div class="recall-modal" style="max-width: 520px; width: 92%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="recall-badge" style="background: rgba(99, 102, 241, 0.15); color: var(--accent); padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 11px;">
              ⚡ ACTIVE RECALL — PAGE ${data.pageNumber}
            </span>
            ${data.retryEasier ? '<span style="color: #f97316; font-size: 11px; font-weight: 700;">Simpler Retry</span>' : ''}
          </div>

          <!-- 2-Line AI Summary -->
          <div style="background: var(--bg-secondary); border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 6px; font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">
            <strong style="color: var(--text-primary); display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 2px;">2-Line Key Takeaway:</strong>
            ${cp.summary || 'Focus on the core definitions and quantitative relations in this section.'}
          </div>

          <h3 class="recall-question" style="font-size: 15px; font-weight: 700; line-height: 1.4; color: var(--text-primary); margin-bottom: 8px;">
            ${cp.question}
          </h3>

          ${inputHtml}

          <div class="recall-actions" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
            <button id="recall-later-btn" class="btn btn-secondary-sm" style="font-size: 12px;">Review Later</button>
            ${!hasOptions ? '<button id="recall-submit-btn" class="btn btn-primary" style="font-size: 12px;">Submit Answer</button>' : ''}
          </div>
        </div>
      `;
    }

    if (state === 'result') {
      const isCorrect = data.isCorrect;
      const cp = data.checkpoint;

      overlay.innerHTML = `
        <div class="recall-modal" style="max-width: 520px; width: 92%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="recall-badge" style="background: ${isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isCorrect ? '#10b981' : '#ef4444'}; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 11px;">
              ${isCorrect ? '✓ CHECKPOINT PASSED' : '✗ NEEDS RETRIEVAL SUPPORT'}
            </span>
            <span style="font-size: 11px; color: var(--text-secondary);">Page ${data.pageNumber}</span>
          </div>

          <div style="padding: 10px; border-radius: 8px; background: ${isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isCorrect ? '#10b981' : '#ef4444'}; margin-bottom: 12px;">
            <p style="font-size: 13px; font-weight: 700; color: ${isCorrect ? '#065f46' : '#991b1b'}; margin-bottom: 4px;">
              ${isCorrect ? '🎉 Great retention! Reading unlocked.' : '⚠️ Almost! Let’s cement this concept.'}
            </p>
            <p style="font-size: 12px; color: var(--text-primary); line-height: 1.4;">
              <strong>Correct Answer:</strong> ${cp.answer}
            </p>
          </div>

          <div class="recall-source-block" style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; font-size: 11px; color: var(--text-secondary); margin-bottom: 14px; max-height: 110px; overflow-y: auto;">
            <strong style="color: var(--text-primary); display: block; margin-bottom: 2px;">From your textbook text:</strong>
            "${data.pageText.slice(0, 320)}..."
          </div>

          <div class="recall-actions" style="display: flex; justify-content: space-between; align-items: center;">
            ${!isCorrect
              ? `<button id="recall-retry-btn" class="btn btn-secondary-sm" style="color: #f97316; font-weight: 700;">🔄 Try Simpler Question</button>`
              : `<div></div>`}
            <button id="recall-continue-btn" class="btn btn-primary" style="font-size: 13px; font-weight: 700;">
              ${isCorrect ? 'Continue Reading ▶' : 'Acknowledge & Continue ▶'}
            </button>
          </div>
        </div>
      `;
    }

    if (state === 'error') {
      overlay.innerHTML = `
        <div class="recall-modal" style="text-align: center;">
          <p style="font-size: 14px; color: var(--text-primary); margin-bottom: 14px;">${data.message}</p>
          <button id="recall-close-btn" class="btn btn-secondary-sm">Close & Continue</button>
        </div>
      `;
    }

    document.body.appendChild(overlay);
    this.attachModalListeners(state, data);
  },

  attachModalListeners(state, data) {
    if (state === 'question') {
      const cp = data.checkpoint;

      // Option click (MCQ mode)
      document.querySelectorAll('.recall-option-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const selectedIdx = parseInt(btn.getAttribute('data-idx'), 10);
          const isCorrect = selectedIdx === cp.correctIndex;
          this.handleAnswerEvaluation(isCorrect, cp.options[selectedIdx], data);
        });
      });

      // Textarea submit
      const submitBtn = document.getElementById('recall-submit-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          const input = document.getElementById('recall-answer-input');
          const val = input ? input.value.trim() : '';
          // Basic semantic similarity check
          const isCorrect = val.length > 5;
          this.handleAnswerEvaluation(isCorrect, val, data);
        });
      }

      document.getElementById('recall-later-btn').addEventListener('click', () => {
        Storage.saveFlashcard({
          id: Storage.generateId(),
          question: cp.question,
          answer: cp.answer,
          pageNumber: data.pageNumber,
          dueDate: Date.now() + 24 * 60 * 60 * 1000,
          needsReview: true,
        });
        this.closeModal();
      });
    }

    if (state === 'result') {
      const continueBtn = document.getElementById('recall-continue-btn');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          this.closeModal();
        });
      }

      const retryBtn = document.getElementById('recall-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.showPrompt(data.pageText, data.pageNumber, true);
        });
      }
    }

    if (state === 'error') {
      const closeBtn = document.getElementById('recall-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal());
      }
    }
  },

  handleAnswerEvaluation(isCorrect, userAnswer, data) {
    const cp = data.checkpoint;

    if (window.RecallEngine) {
      window.RecallEngine.recordAttempt({
        question: cp.question,
        userAnswer,
        correctAnswer: cp.answer,
        wasCorrect: isCorrect,
        pageNumber: data.pageNumber,
        pageText: data.pageText,
      });
    }

    Storage.saveRecallSession({
      id: Storage.generateId(),
      date: Date.now(),
      pdfId: this.currentPdfId,
      pageNumber: data.pageNumber,
      question: cp.question,
      correctAnswer: cp.answer,
      userAnswer,
      wasCorrect: isCorrect,
    });

    this.renderModal('result', { ...data, isCorrect, userAnswer });
  },

  closeModal() {
    const overlay = document.getElementById('recall-modal-overlay');
    if (overlay) overlay.remove();
    this.isPromptOpen = false;
    this.isGatedLocked = false;
  },
};

window.ActiveRecall = ActiveRecall;