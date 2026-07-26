window.Pages.Quiz = {
  state: {
    mode: 'setup', // 'setup' | 'taking' | 'results'
    questions: [], // [{ question, options: [4], correctIndex, explanation }]
    currentIndex: 0,
    answers: [], // answers[i] = selected option index, or undefined if unanswered
  },

  render() {
    return `
      <div class="page-header">
        <h1>Quiz</h1>
        <p class="page-subtitle">Test yourself with AI-generated multiple-choice questions</p>
      </div>

      <div id="quiz-content"></div>
    `;
  },

  async afterRender() {
    this.state.mode = 'setup';
    this.state.questions = [];
    this.state.currentIndex = 0;
    this.state.answers = [];
    await this.renderSetup();
  },

  async renderSetup() {
    const content = document.getElementById('quiz-content');

    content.innerHTML = `
      <div class="quiz-setup">
        <label class="settings-label">Select a PDF</label>
        <select id="quiz-pdf-select" class="manual-form-input" style="margin-bottom: 12px;">
          <option value="">Select a PDF to generate from...</option>
        </select>

        <label class="settings-label">Number of Questions</label>
        <input
          type="number"
          id="quiz-count-input"
          class="manual-form-input"
          value="5"
          min="3"
          max="15"
          style="margin-bottom: 16px;"
        />

        <button id="quiz-generate-btn" class="btn btn-primary">✨ Generate Quiz</button>
        <div id="quiz-generate-status"></div>
      </div>
    `;

    const select = document.getElementById('quiz-pdf-select');
    const pdfs = await DB.getAllPDFs();
    pdfs.forEach((pdf) => {
      const option = document.createElement('option');
      option.value = pdf.id;
      option.textContent = pdf.name;
      select.appendChild(option);
    });

    document.getElementById('quiz-generate-btn').addEventListener('click', () => this.generateQuiz());
  },

  async generateQuiz() {
    const pdfId = document.getElementById('quiz-pdf-select').value;
    const countInput = document.getElementById('quiz-count-input');
    const statusEl = document.getElementById('quiz-generate-status');

    if (!pdfId) {
      statusEl.innerHTML = `<p class="status-error">Please select a PDF first.</p>`;
      return;
    }

    let count = parseInt(countInput.value, 10);
    if (isNaN(count) || count < 3) count = 3;
    if (count > 15) count = 15;

    try {
      // Reuse the Flashcards page's PDF text extraction (handles OCR fallback + caching)
      const fullText = await window.Pages.Flashcards.extractFullPdfText(pdfId, statusEl);

      if (fullText.trim().length < 50) {
        statusEl.innerHTML = `<p class="status-error">Couldn't extract enough text from this PDF.</p>`;
        return;
      }

      statusEl.innerHTML = `<p class="status-info">Generating quiz questions with AI...</p>`;

      const questions = await Gemini.generateMCQs(fullText, count);

      if (!questions || questions.length === 0) {
        throw new Error('No questions generated');
      }

      this.state.questions = questions;
      this.state.answers = new Array(questions.length).fill(undefined);
      this.state.currentIndex = 0;
      this.state.mode = 'taking';

      statusEl.innerHTML = '';
      this.renderTaking();
    } catch (error) {
      console.error('Quiz generation failed:', error);

      const friendlyMessage =
        error.message === 'RATE_LIMIT' || error.message === 'Request timed out — Gemini took too long to respond'
          ? 'The AI is briefly busy (free-tier limit). This clears itself within a minute — try again shortly.'
          : 'Generation failed. Please try again.';

      statusEl.innerHTML = `<p class="status-error">${friendlyMessage}</p>`;
    }
  },

  renderTaking() {
    const content = document.getElementById('quiz-content');
    const { questions, currentIndex, answers } = this.state;
    const q = questions[currentIndex];
    const selected = answers[currentIndex];
    const isLast = currentIndex === questions.length - 1;

    content.innerHTML = `
      <div class="quiz-progress">Question ${currentIndex + 1} of ${questions.length}</div>
      <div class="quiz-question">${q.question}</div>

      <div class="quiz-options">
        ${q.options
          .map(
            (opt, i) => `
          <button class="quiz-option ${selected === i ? 'selected' : ''}" data-index="${i}">
            ${opt}
          </button>
        `
          )
          .join('')}
      </div>

      <div class="quiz-nav">
        <button id="quiz-prev-btn" class="btn btn-secondary-sm" ${currentIndex === 0 ? 'disabled' : ''}>◀ Previous</button>
        <button id="quiz-next-btn" class="btn btn-primary" ${selected === undefined ? 'disabled' : ''}>
          ${isLast ? 'See Results' : 'Next ▶'}
        </button>
      </div>
    `;

    content.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        this.state.answers[this.state.currentIndex] = index;
        this.renderTaking();
      });
    });

    const prevBtn = document.getElementById('quiz-prev-btn');
    if (!prevBtn.disabled) {
      prevBtn.addEventListener('click', () => {
        this.state.currentIndex--;
        this.renderTaking();
      });
    }

    const nextBtn = document.getElementById('quiz-next-btn');
    if (!nextBtn.disabled) {
      nextBtn.addEventListener('click', () => {
        if (isLast) {
          this.state.mode = 'results';
          this.renderResults();
        } else {
          this.state.currentIndex++;
          this.renderTaking();
        }
      });
    }
  },

  renderResults() {
    const content = document.getElementById('quiz-content');
    const { questions, answers } = this.state;

    let correctCount = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correctCount++;
    });
    const percentage = Math.round((correctCount / questions.length) * 100);

    content.innerHTML = `
      <div class="quiz-score-card">
        <div class="quiz-score-big">${correctCount}/${questions.length}</div>
        <div class="quiz-score-percentage">${percentage}% correct</div>
      </div>

      <div class="quiz-review-list">
        ${questions
          .map((q, i) => {
            const userAnswer = answers[i];
            const wasCorrect = userAnswer === q.correctIndex;
            const userAnswerText = userAnswer === undefined ? '(skipped)' : q.options[userAnswer];

            return `
              <div class="quiz-review-item ${wasCorrect ? '' : 'incorrect'}">
                <div class="quiz-review-question">${i + 1}. ${q.question}</div>
                <div class="quiz-review-answer">Your answer: ${userAnswerText}</div>
                ${
                  wasCorrect
                    ? ''
                    : `<div class="quiz-review-correct">Correct answer: ${q.options[q.correctIndex]}</div>`
                }
                ${q.explanation ? `<div class="quiz-review-explanation">${q.explanation}</div>` : ''}
              </div>
            `;
          })
          .join('')}
      </div>

      <button id="quiz-retake-btn" class="btn btn-primary">🔁 Take Another Quiz</button>
    `;

    document.getElementById('quiz-retake-btn').addEventListener('click', () => {
      this.state.mode = 'setup';
      this.state.questions = [];
      this.state.currentIndex = 0;
      this.state.answers = [];
      this.renderSetup();
    });
  },
};