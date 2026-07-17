window.Pages.Analytics = {
  render() {
    return `
      <div class="page-header">
        <h1>Analytics</h1>
        <p class="page-subtitle">Deeper insights into your study habits</p>
      </div>

      <div id="analytics-content">
        <p class="placeholder-content">Loading analytics...</p>
      </div>
    `;
  },

  afterRender() {
    const content = document.getElementById('analytics-content');

    const readingHistory = Storage.getReadingHistory();
    const quizHistory = Storage.getQuizHistory();
    const recallSessions = Storage.getRecallSessions();
    const flashcards = Storage.getFlashcards(); 
    content.innerHTML = `
      <div class="dashboard-panel" style="margin-bottom: var(--space-md);">
        <h3 class="dashboard-panel-title">Reading Activity (last 12 weeks)</h3>
        <div id="heatmap-container"></div>
      </div>

      <div class="dashboard-row" style="margin-bottom: var(--space-md);">
        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">Quiz Score Trend</h3>
          <div id="quiz-trend-container"></div>
        </div>
        <div class="dashboard-panel">
          <h3 class="dashboard-panel-title">Active Recall Accuracy Trend</h3>
          <div id="recall-trend-container"></div>
        </div>
      </div>

     <div class="dashboard-panel" style="margin-bottom: var(--space-md);">
        <h3 class="dashboard-panel-title">Weak Topics — Frequently Missed Questions</h3>
        <div id="weak-topics-container"></div>
      </div>

      <div class="dashboard-panel">
        <h3 class="dashboard-panel-title">Revision Calendar — Next 14 Days</h3>
        <div id="revision-calendar-container"></div>
      </div>
    `;

    this.renderHeatmap(readingHistory);
    this.renderQuizTrend(quizHistory);
    this.renderRecallTrend(recallSessions);
    this.renderWeakTopics(recallSessions, quizHistory);
    this.renderRevisionCalendar(flashcards);
  },

  renderRevisionCalendar(flashcards) {
    const container = document.getElementById('revision-calendar-container');
    const upcoming = SpacedRepetition.getUpcoming(flashcards, 14);
    const entries = Object.entries(upcoming);
    const maxCount = Math.max(1, ...entries.map(([, count]) => count));

    container.innerHTML = `
      <div class="revision-calendar">
        ${entries
          .map(([dateStr, count]) => {
            const date = new Date(dateStr);
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dateLabel = date.getDate();
            const heightPercent = count > 0 ? Math.max(15, (count / maxCount) * 100) : 4;

            return `
              <div class="revision-day-col">
                <div class="revision-bar ${count > 0 ? 'revision-bar-active' : ''}" style="height: ${heightPercent}%" title="${count} card${count === 1 ? '' : 's'} due"></div>
                <span class="revision-day-count">${count > 0 ? count : ''}</span>
                <span class="revision-day-label">${dayLabel}</span>
                <span class="revision-date-label">${dateLabel}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  },
  // --- Reading heatmap: 12 weeks x 7 days grid ---
  renderHeatmap(readingHistory) {
    const container = document.getElementById('heatmap-container');

    const dateStrings = new Set(readingHistory.map((h) => new Date(h.lastReadAt).toDateString()));

    const weeks = 12;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - weeks * 7);
    // Align start to a Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let html = '<div class="heatmap-grid">';
    let cursor = new Date(startDate);

    for (let w = 0; w < weeks; w++) {
      html += '<div class="heatmap-week">';
      for (let d = 0; d < 7; d++) {
        const isActive = dateStrings.has(cursor.toDateString());
        const isFuture = cursor > today;
        html += `<div class="heatmap-cell ${isActive ? 'heatmap-active' : ''} ${isFuture ? 'heatmap-future' : ''}" title="${cursor.toDateString()}"></div>`;
        cursor.setDate(cursor.getDate() + 1);
      }
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
  },

  // --- Quiz score trend: simple SVG line chart ---
  renderQuizTrend(quizHistory) {
    const container = document.getElementById('quiz-trend-container');

    if (quizHistory.length === 0) {
      container.innerHTML = `<p class="annotations-empty">Take a quiz to see your trend here.</p>`;
      return;
    }

    const recent = quizHistory.slice(-10);
    const scores = recent.map((q) => Math.round((q.score / q.total) * 100));

    container.innerHTML = this.buildLineChart(scores, '#4f46e5');
  },

  // --- Recall accuracy trend ---
  renderRecallTrend(recallSessions) {
    const container = document.getElementById('recall-trend-container');
    const answered = recallSessions.filter((s) => s.wasCorrect !== undefined && !s.reviewLater);

    if (answered.length === 0) {
      container.innerHTML = `<p class="annotations-empty">Answer some Active Recall questions to see your trend here.</p>`;
      return;
    }

    // Group into buckets of 5 sessions, showing rolling accuracy
    const bucketSize = Math.max(1, Math.floor(answered.length / 10));
    const buckets = [];
    for (let i = 0; i < answered.length; i += bucketSize) {
      const chunk = answered.slice(i, i + bucketSize);
      const accuracy = Math.round((chunk.filter((s) => s.wasCorrect).length / chunk.length) * 100);
      buckets.push(accuracy);
    }

    container.innerHTML = this.buildLineChart(buckets.slice(-10), '#16a34a');
  },

  // Generic small SVG line chart, values 0-100
  buildLineChart(values, color) {
    const width = 280;
    const height = 100;
    const padding = 10;

    if (values.length === 1) values = [values[0], values[0]]; // need at least 2 points to draw a line

    const stepX = (width - padding * 2) / (values.length - 1);

    const points = values
      .map((v, i) => {
        const x = padding + i * stepX;
        const y = height - padding - (v / 100) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const lastValue = values[values.length - 1];

    return `
      <svg viewBox="0 0 ${width} ${height}" class="trend-chart">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ${values
          .map((v, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (v / 100) * (height - padding * 2);
            return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" />`;
          })
          .join('')}
      </svg>
      <p class="trend-latest">Latest: <strong>${lastValue}%</strong></p>
    `;
  },

  // --- Weak topics: questions most often answered incorrectly ---
  renderWeakTopics(recallSessions, quizHistory) {
    const container = document.getElementById('weak-topics-container');

    const wrongCounts = {};

    recallSessions
      .filter((s) => s.wasCorrect === false)
      .forEach((s) => {
        wrongCounts[s.question] = (wrongCounts[s.question] || 0) + 1;
      });

    quizHistory.forEach((quiz) => {
      quiz.questions.forEach((q) => {
        if (!q.wasCorrect) {
          wrongCounts[q.question] = (wrongCounts[q.question] || 0) + 1;
        }
      });
    });

    const sorted = Object.entries(wrongCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sorted.length === 0) {
      container.innerHTML = `<p class="annotations-empty">No missed questions yet — keep studying to build this list.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="weak-topics-list">
        ${sorted
          .map(
            ([question, count]) => `
          <div class="weak-topic-item">
            <span class="weak-topic-count">${count}×</span>
            <span class="weak-topic-question">${question}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  },
};