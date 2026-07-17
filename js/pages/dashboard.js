window.Pages.Dashboard = {
  render() {
    return `
      <div class="page-header">
        <h1>Dashboard</h1>
        <p class="page-subtitle">Your study overview</p>
      </div>

      <div id="dashboard-content">
        <p class="placeholder-content">Loading your stats...</p>
      </div>
    `;
  },

  async afterRender() {
    const content = document.getElementById('dashboard-content');

    const pdfs = await DB.getAllPDFs();
    const readingHistory = Storage.getReadingHistory();
    const quizHistory = Storage.getQuizHistory();
    const flashcards = Storage.getFlashcards();
    const recallSessions = Storage.getRecallSessions();
    const profile = Storage.getProfile();
    const dueCards = SpacedRepetition.getDueCards(flashcards);

    const totalPdfs = pdfs.length;

    const avgQuizScore =
      quizHistory.length > 0
        ? Math.round(
            (quizHistory.reduce((sum, q) => sum + q.score / q.total, 0) / quizHistory.length) * 100
          )
        : null;

    const recallAnswered = recallSessions.filter((s) => !s.reviewLater && s.wasCorrect !== undefined);
    const recallAccuracy =
      recallAnswered.length > 0
        ? Math.round((recallAnswered.filter((s) => s.wasCorrect).length / recallAnswered.length) * 100)
        : null;

    const streak = this.calculateStreak(readingHistory);
    const weekActivity = this.getWeekActivity(readingHistory);

    const settings = Storage.getSettings();
    const todayMinutes = Storage.getTodayStudyMinutes();
    const goalMinutes = settings.dailyGoalMinutes || 30;
    const goalPercent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));

    const recentPdfIds = [...readingHistory]
      .sort((a, b) => b.lastReadAt - a.lastReadAt)
      .slice(0, 5)
      .map((h) => h.pdfId);

    const recentPdfs = recentPdfIds
      .map((id) => pdfs.find((p) => p.id === id))
      .filter(Boolean);

    content.innerHTML = `
      <p class="dashboard-greeting">Welcome back, ${profile.name || 'Student'} 👋</p>

      ${
        dueCards.length > 0
          ? `<div class="revision-reminder-banner">
              <span>🔁 You have <strong>${dueCards.length}</strong> flashcard${dueCards.length === 1 ? '' : 's'} due for review today.</span>
              <button id="go-review-btn" class="btn btn-primary btn-sm-timer">Review Now</button>
            </div>`
          : ''
      }

      <div class="dashboard-stats-grid">
        <div class="stat-card">
          <span class="stat-icon">📚</span>
          <p class="stat-value">${totalPdfs}</p>
          <p class="stat-label">PDFs in Library</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <p class="stat-value">${streak}</p>
          <p class="stat-label">Day Streak</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🗂️</span>
          <p class="stat-value">${flashcards.length}</p>
          <p class="stat-label">Flashcards</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">❓</span>
          <p class="stat-value">${avgQuizScore !== null ? avgQuizScore + '%' : '—'}</p>
          <p class="stat-label">Avg Quiz Score</p>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔁</span>
          <p class="stat-value">${recallAccuracy !== null ? recallAccuracy + '%' : '—'}</p>
          <p class="stat-label">Recall Accuracy</p>
        </div>
      </div>

      <div class="dashboard-panel" style="margin-bottom: var(--space-md);">
        <h3 class="dashboard-panel-title">Today's Goal — ${todayMinutes} / ${goalMinutes} min</h3>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${goalPercent}%"></div>
        </div>
      </div>

      <div class="dashboard-row">
        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">This Week</h3>
          <div class="week-bar-chart">
            ${weekActivity
              .map(
                (day) => `
              <div class="week-bar-col">
                <div class="week-bar ${day.active ? 'week-bar-active' : ''}" style="height: ${day.active ? '100%' : '8%'}"></div>
                <span class="week-bar-label">${day.label}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">Continue Reading</h3>
          ${
            recentPdfs.length === 0
              ? `<p class="annotations-empty">No reading history yet. Open a PDF to get started.</p>`
              : `<div class="recent-pdf-list">
                  ${recentPdfs
                    .map(
                      (pdf) => `
                    <div class="recent-pdf-item" data-id="${pdf.id}">
                      <span class="recent-pdf-icon">📄</span>
                      <span class="recent-pdf-name">${pdf.name}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      </div>
    `;

    content.querySelectorAll('.recent-pdf-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        Router.navigate(`/reader?id=${id}`);
      });
    });
  },

  calculateStreak(readingHistory) {
    if (readingHistory.length === 0) return 0;

    const dateStrings = new Set(
      readingHistory.map((h) => new Date(h.lastReadAt).toDateString())
    );

    let streak = 0;
    let cursor = new Date();

    while (dateStrings.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  },

  getWeekActivity(readingHistory) {
    const dateStrings = new Set(
      readingHistory.map((h) => new Date(h.lastReadAt).toDateString())
    );

    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        active: dateStrings.has(d.toDateString()),
      });
    }

    return days;
  },
};