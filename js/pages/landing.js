window.Pages.Landing = {
  render() {
    return `
      <div class="landing">
        <header class="landing-nav">
          <div class="brand">
            <span class="brand-icon">🧠</span>
            <span class="brand-name">Recall</span>
          </div>
          <a href="#/dashboard" class="btn btn-primary">Get Started</a>
        </header>

        <section class="landing-hero">
          <h1>Read less. Remember more.</h1>
          <p class="hero-subtitle">
            An AI-powered PDF reader that quizzes you as you read, so what you
            study actually sticks.
          </p>
          <a href="#/dashboard" class="btn btn-primary btn-lg">Start Studying</a>
        </section>

        <section class="landing-features">
          <div class="feature-card">
            <span class="feature-icon">🔁</span>
            <h3>Active Recall</h3>
            <p>Get quizzed on what you just read, right inside the PDF.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">✨</span>
            <h3>AI Summaries</h3>
            <p>Instant chapter summaries, flashcards, and quizzes from any PDF.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">📈</span>
            <h3>Track Progress</h3>
            <p>See your reading streaks, recall accuracy, and weak topics.</p>
          </div>
        </section>
      </div>
    `;
  },
};