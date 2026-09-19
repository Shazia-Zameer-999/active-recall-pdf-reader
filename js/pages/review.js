// js/pages/review.js — RecalIo Spaced Repetition Review Hub (Feature 3)

window.Pages.Review = {
  state: {
    currentCardIdx: 0,
    isFlipped: false,
  },

  render() {
    const flashcards = Storage.getFlashcards();
    const dueCards = SpacedRepetition.getDueCards(flashcards);
    const masteredCards = flashcards.filter((c) => (c.repetitions || 0) >= 3);
    const needsReviewCards = flashcards.filter((c) => c.needsReview);

    const currentCard = dueCards[this.state.currentCardIdx];

    return `
      <div class="review-page">
        <div class="page-header">
          <h1>Spaced Repetition Review</h1>
          <p class="page-subtitle">Cement long-term retention using the SM-2 decay algorithm. Review concepts right before they fade.</p>
        </div>

        <!-- Stats Grid -->
        <div class="review-stats-grid">
          <div class="stat-card" style="border-top: 3px solid #ef4444;">
            <span class="stat-icon">🔁</span>
            <p class="stat-value" style="color: #ef4444;">${dueCards.length}</p>
            <p class="stat-label">Due Today</p>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f59e0b;">
            <span class="stat-icon">⚠️</span>
            <p class="stat-value" style="color: #f59e0b;">${needsReviewCards.length}</p>
            <p class="stat-label">Needs Review</p>
          </div>
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <span class="stat-icon">🏆</span>
            <p class="stat-value" style="color: #10b981;">${masteredCards.length}</p>
            <p class="stat-label">Mastered</p>
          </div>
          <div class="stat-card" style="border-top: 3px solid var(--accent);">
            <span class="stat-icon">📚</span>
            <p class="stat-value">${flashcards.length}</p>
            <p class="stat-label">Total Vault</p>
          </div>
        </div>

        <!-- Flashcard Active Review Stage -->
        ${
          currentCard
            ? `
          <div class="review-card-stage">
            <div class="sm2-card">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="pill-title" style="background: rgba(99, 102, 241, 0.15); color: var(--accent);">
                    Card ${this.state.currentCardIdx + 1} of ${dueCards.length}
                  </span>
                  <span style="font-size: 11px; color: var(--text-secondary);">
                    Interval: ${currentCard.interval || 0}d • Reps: ${currentCard.repetitions || 0}
                  </span>
                </div>

                <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-primary); line-height: 1.4;">
                  ${currentCard.question}
                </h2>

                ${
                  this.state.isFlipped
                    ? `
                  <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); animation: fadeIn 0.25s ease;">
                    <p style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 4px;">Answer:</p>
                    <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); line-height: 1.5;">
                      ${currentCard.answer}
                    </p>
                    ${
                      currentCard.sourceSnippet
                        ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px; font-style: italic;">"${currentCard.sourceSnippet}"</p>`
                        : ''
                    }
                  </div>
                `
                    : ''
                }
              </div>

              ${
                !this.state.isFlipped
                  ? `
                <button id="btn-flip-card" class="btn btn-primary" style="margin-top: 24px; justify-content: center; padding: 12px; font-weight: 700;">
                  Show Answer (Space)
                </button>
              `
                  : `
                <div class="sm2-ratings-row">
                  <button class="sm2-rate-btn rate-again" data-rating="0">
                    Again<br><span style="font-size:10px; font-weight:normal;">&lt; 1 day</span>
                  </button>
                  <button class="sm2-rate-btn rate-hard" data-rating="1">
                    Hard<br><span style="font-size:10px; font-weight:normal;">1 day</span>
                  </button>
                  <button class="sm2-rate-btn rate-good" data-rating="2">
                    Good<br><span style="font-size:10px; font-weight:normal;">6 days</span>
                  </button>
                  <button class="sm2-rate-btn rate-easy" data-rating="3">
                    Easy<br><span style="font-size:10px; font-weight:normal;">14 days</span>
                  </button>
                </div>
              `
              }
            </div>
          </div>
        `
            : `
          <div class="card" style="text-align: center; padding: 50px 20px;">
            <span style="font-size: 48px;">🎉</span>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin: 8px 0;">All caught up for today!</h2>
            <p style="color: var(--text-secondary); font-size: 0.95rem; max-width: 420px; margin: 0 auto 18px auto;">
              You have completed all active recall reviews due today. Missed questions from reading sessions and group quiz battles will appear here tomorrow.
            </p>
            <button id="btn-read-more" class="btn btn-primary">
              Continue Reading PDFs ▶
            </button>
          </div>
        `
        }
      </div>
    `;
  },

  afterRender() {
    const flipBtn = document.getElementById('btn-flip-card');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        this.state.isFlipped = true;
        Router.render();
      });
    }

    const readMoreBtn = document.getElementById('btn-read-more');
    if (readMoreBtn) {
      readMoreBtn.addEventListener('click', () => {
        Router.navigate('/library');
      });
    }

    // Handle SM-2 rating buttons
    document.querySelectorAll('.sm2-rate-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rating = parseInt(btn.getAttribute('data-rating'), 10);
        const flashcards = Storage.getFlashcards();
        const dueCards = SpacedRepetition.getDueCards(flashcards);
        const currentCard = dueCards[this.state.currentCardIdx];

        if (currentCard) {
          const updated = SpacedRepetition.review(currentCard, rating);
          updated.needsReview = rating === 0;
          Storage.saveFlashcard(updated);

          if (window.Gamification) {
            window.Gamification.addXP(25, 'SM-2 Review Completed');
          }
        }

        this.state.isFlipped = false;
        Router.render();
      });
    });

    // Keyboard shortcuts: Space to flip
    const handleKey = (e) => {
      if (Router.getCurrentPath() !== '/review') {
        window.removeEventListener('keydown', handleKey);
        return;
      }
      if (e.key === ' ' && !this.state.isFlipped) {
        e.preventDefault();
        this.state.isFlipped = true;
        Router.render();
      }
    };
    window.addEventListener('keydown', handleKey);
  },
};
