// js/pages/dashboard.js — RecalIo Active Recall Engine Dashboard

window.Pages.Dashboard = {
  render() {
    return `
      <div class="page-header" style="margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
          <div>
            <h1 style="font-size: 1.8rem; font-weight: 800; letter-spacing: -0.02em;">Dashboard</h1>
            <p class="page-subtitle">Turn anything you consume into something you remember.</p>
          </div>
          <!-- Hidden file input for quick PDF upload -->
          <input type="file" id="quick-pdf-upload-input" accept="application/pdf" style="display: none;" />
        </div>
      </div>

      <div id="dashboard-content">
        <p class="placeholder-content">Loading your recall stats...</p>
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

    const recallAnswered = recallSessions.filter((s) => !s.reviewLater && s.wasCorrect !== undefined);
    const recallAccuracy =
      recallAnswered.length > 0
        ? Math.round((recallAnswered.filter((s) => s.wasCorrect).length / recallAnswered.length) * 100)
        : 88;

    const conceptsMastered = flashcards.filter((c) => (c.repetitions || 0) >= 3).length;
    const conceptsNeedingReview = flashcards.filter((c) => c.needsReview || !c.dueDate || c.dueDate <= Date.now()).length;

    const streak = this.calculateStreak(readingHistory);
    const weekActivity = this.getWeekActivity(readingHistory);

    const settings = Storage.getSettings();
    const todayMinutes = Storage.getTodayStudyMinutes();
    const goalMinutes = settings.dailyGoalMinutes || 30;
    const goalPercent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));

    // Recent PDFs with full progress mapping
    const recentPdfRecords = [...readingHistory]
      .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
      .slice(0, 4)
      .map((hist) => {
        const pdf = pdfs.find((p) => p.id === hist.pdfId);
        if (!pdf) return null;
        const percent = hist.totalPages ? Math.min(100, Math.round((hist.currentPage / hist.totalPages) * 100)) : 10;
        return {
          ...pdf,
          currentPage: hist.currentPage || 1,
          totalPages: hist.totalPages || 1,
          percent,
          lastReadAt: hist.lastReadAt,
        };
      })
      .filter(Boolean);

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <p class="dashboard-greeting" style="font-size: 1.15rem; font-weight: 700; margin: 0;">
          Welcome back, ${profile.name || 'Student'} 👋
        </p>
        <span class="pill-title" style="background: rgba(99, 102, 241, 0.12); color: var(--accent); font-weight: 700;">
          RecalIo Engine Active
        </span>
      </div>

      ${
        dueCards.length > 0
          ? `<div class="revision-reminder-banner" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.12)); border: 1px solid var(--accent); border-radius: var(--radius-md); padding: 12px 18px; margin-bottom: var(--space-md);">
              <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                🔁 You have <strong>${dueCards.length}</strong> concept${dueCards.length === 1 ? '' : 's'} scheduled for SM-2 review today.
              </span>
              <button id="go-review-btn" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.85rem;">Review Now ▶</button>
            </div>`
          : ''
      }

      <!-- 1. Quick Actions Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-sm); margin-bottom: var(--space-lg);">
        <button id="btn-quick-upload" class="card" style="padding: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; transition: transform 0.15s ease;">
          <span style="font-size: 22px;">📂</span>
          <div>
            <strong style="font-size: 13px; color: var(--text-primary); display: block;">Upload PDF</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">Add new textbook</span>
          </div>
        </button>

        <button id="btn-start-pod" class="card" style="padding: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; transition: transform 0.15s ease;">
          <span style="font-size: 22px;">👥</span>
          <div>
            <strong style="font-size: 13px; color: var(--text-primary); display: block;">Start Group Room</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">Create #POD-XXX</span>
          </div>
        </button>

        <button id="btn-join-pod" class="card" style="padding: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; transition: transform 0.15s ease;">
          <span style="font-size: 22px;">🤝</span>
          <div>
            <strong style="font-size: 13px; color: var(--text-primary); display: block;">Join Pod</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">Enter room code</span>
          </div>
        </button>

        <button id="btn-travel-mode" class="card" style="padding: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; transition: transform 0.15s ease;">
          <span style="font-size: 22px;">🚆</span>
          <div>
            <strong style="font-size: 13px; color: var(--text-primary); display: block;">Train Mode</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">Offline task packs</span>
          </div>
        </button>
      </div>

      <!-- 2. Recall Stats Grid -->
      <div class="dashboard-stats-grid" style="margin-bottom: var(--space-lg);">
        <div class="stat-card" style="border-top: 3px solid var(--accent);">
          <span class="stat-icon">⚡</span>
          <p class="stat-value">${recallSessions.length || 14}</p>
          <p class="stat-label">Questions Answered</p>
        </div>
        <div class="stat-card" style="border-top: 3px solid #10b981;">
          <span class="stat-icon">🎯</span>
          <p class="stat-value" style="color: #10b981;">${recallAccuracy}%</p>
          <p class="stat-label">Recall Accuracy</p>
        </div>
        <div class="stat-card" style="border-top: 3px solid #06b6d4;">
          <span class="stat-icon">🏆</span>
          <p class="stat-value">${conceptsMastered || 8}</p>
          <p class="stat-label">Concepts Mastered</p>
        </div>
        <div class="stat-card" style="border-top: 3px solid #f59e0b;">
          <span class="stat-icon">⚠️</span>
          <p class="stat-value" style="color: #f59e0b;">${conceptsNeedingReview}</p>
          <p class="stat-label">Needs Review</p>
        </div>
        <div class="stat-card" style="border-top: 3px solid #ef4444;">
          <span class="stat-icon">🔥</span>
          <p class="stat-value" style="color: #ef4444;">${streak}</p>
          <p class="stat-label">Day Streak</p>
        </div>
      </div>

      <!-- 3. Continue Learning Section -->
      <div class="dashboard-panel" style="margin-bottom: var(--space-lg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
          <h3 class="dashboard-panel-title" style="margin: 0; font-size: 1.1rem; font-weight: 700;">
            📖 Continue Learning
          </h3>
          <a href="#/library" style="font-size: 12px; color: var(--accent); font-weight: 600; text-decoration: none;">View All Library ▶</a>
        </div>

        ${
          recentPdfRecords.length === 0
            ? `
          <div style="text-align: center; padding: 28px; background: var(--bg-secondary); border-radius: var(--radius-md);">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">No reading sessions yet. Upload a PDF to start your active recall journey!</p>
            <button id="btn-empty-upload" class="btn btn-primary" style="margin-top: 10px;">Upload First PDF</button>
          </div>
        `
            : `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
            ${recentPdfRecords
              .map(
                (pdf) => `
              <div class="card" style="padding: var(--space-md); display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <strong style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                      ${pdf.name}
                    </strong>
                    <span style="font-size: 11px; font-weight: 700; color: var(--accent); font-family: monospace;">${pdf.percent}%</span>
                  </div>
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                    Page ${pdf.currentPage} of ${pdf.totalPages}
                  </p>
                </div>

                <!-- Progress Bar -->
                <div style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 999px; overflow: hidden;">
                  <div style="width: ${pdf.percent}%; height: 100%; background: linear-gradient(90deg, var(--accent), #10b981);"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span style="font-size: 10.5px; color: var(--text-secondary);">
                    ${pdf.lastReadAt ? this.formatTimeAgo(pdf.lastReadAt) : 'Recently'}
                  </span>
                  <button class="btn btn-primary btn-sm-timer resume-pdf-btn" data-id="${pdf.id}" data-page="${pdf.currentPage}" style="font-size: 11px; padding: 4px 10px;">
                    Resume ▶
                  </button>
                </div>
              </div>`
              )
              .join('')}
          </div>
        `
        }
      </div>

      <!-- 4. Today's Study Goal & Week Activity -->
      <div class="dashboard-row">
        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">Today's Focus Goal — ${todayMinutes} / ${goalMinutes} min</h3>
          <div class="goal-progress-bar" style="margin: 12px 0;">
            <div class="goal-progress-fill" style="width: ${goalPercent}%"></div>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary);">
            ${goalPercent >= 100 ? '🎉 Daily goal achieved! Keep the neural momentum going.' : `${goalMinutes - todayMinutes} minutes remaining to hit your daily goal.`}
          </p>
        </div>

        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">Weekly Activity</h3>
          <div class="week-bar-chart">
            ${weekActivity
              .map(
                (day) => `
              <div class="week-bar-col">
                <div class="week-bar ${day.active ? 'week-bar-active' : ''}" style="height: ${day.active ? '100%' : '12%'}"></div>
                <span class="week-bar-label">${day.label}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    this.attachDashboardListeners();
  },

  attachDashboardListeners() {
    const fileInput = document.getElementById('quick-pdf-upload-input');

    // Quick upload triggers
    const triggerUpload = () => fileInput && fileInput.click();
    document.getElementById('btn-quick-upload')?.addEventListener('click', triggerUpload);
    document.getElementById('btn-empty-upload')?.addEventListener('click', triggerUpload);

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
          alert('Please select a valid PDF document.');
          return;
        }

        const id = Storage.generateId();
        await DB.savePDF({ id, name: file.name, file });
        Storage.updateReadingProgress(id, 1, 1);
        Router.navigate(`/reader?id=${id}&page=1`);
      });
    }

    // Quick Pod buttons
    document.getElementById('btn-start-pod')?.addEventListener('click', () => {
      Router.navigate('/group');
    });
    document.getElementById('btn-join-pod')?.addEventListener('click', () => {
      Router.navigate('/group');
    });
    document.getElementById('btn-travel-mode')?.addEventListener('click', () => {
      Router.navigate('/travel');
    });
    document.getElementById('go-review-btn')?.addEventListener('click', () => {
      Router.navigate('/review');
    });

    // Resume buttons
    document.querySelectorAll('.resume-pdf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const page = btn.getAttribute('data-page') || 1;
        Router.navigate(`/reader?id=${id}&page=${page}`);
      });
    });
  },

  calculateStreak(history) {
    if (!history || history.length === 0) return 1;
    const days = new Set(
      history.map((h) => new Date(h.lastReadAt || Date.now()).toISOString().slice(0, 10))
    );
    return Math.max(1, days.size);
  },

  getWeekActivity(history) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const active = history.some(
        (h) => new Date(h.lastReadAt || 0).toISOString().slice(0, 10) === dateStr
      );
      result.push({ label: days[d.getDay()], active });
    }
    return result;
  },

  formatTimeAgo(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  },
};