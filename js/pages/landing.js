window.Pages.Landing = {
  render() {
    return `
      <div class="landing">
        <header class="landing-nav">
          <div class="brand">
            <span class="brand-icon">🧠</span>
            <span class="brand-name" style="font-weight: 800; letter-spacing: -0.02em;">RecalIo</span>
          </div>
          <a href="#/dashboard" class="btn btn-primary">Get Started</a>
        </header>

        <section class="landing-hero">
          <div class="pill-title" style="background: rgba(99, 102, 241, 0.15); color: var(--accent); margin-bottom: 12px;">
            The Active Recall Engine
          </div>
          <h1>Turn anything you consume into something you remember.</h1>
          <p class="hero-subtitle">
            An AI-powered active-recall layer that turns passive reading, videos, and idle train travel into permanent neural retention.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="#/dashboard" class="btn btn-primary btn-lg">Start Learning</a>
            <a href="#/group" class="btn btn-secondary-sm btn-lg" style="font-weight: 700; padding: 12px 22px;">Join Study Pod</a>
          </div>
        </section>

        <section class="landing-features">
          <div class="feature-card">
            <span class="feature-icon">⚡</span>
            <h3>In-Flow Gated Recall</h3>
            <p>Adaptive checkpoints pause passive skimming; answer to unlock the next chapter.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">👥</span>
            <h3>Study Pods (#POD-782)</h3>
            <p>Live green focus signals keep friend groups accountable, culminating in instant AI quiz battles.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🚆</span>
            <h3>Train & Travel Mode</h3>
            <p>Pre-download offline task packs and duel nearby passengers via Bluetooth with 0 cellular data.</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🔁</span>
            <h3>SM-2 Spaced Repetition</h3>
            <p>Missed concepts automatically bridge into an SM-2 decay schedule so nothing is ever forgotten.</p>
          </div>
        </section>
      </div>
    `;
  },
};