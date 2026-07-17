const Timer = {
  state: {
    mode: 'work', // 'work' | 'break'
    workMinutes: 25,
    breakMinutes: 5,
    secondsLeft: 25 * 60,
    isRunning: false,
    intervalId: null,
    isVisible: false,
    minutesTrackedThisSession: 0,
  },

  toggleVisibility() {
    this.state.isVisible = !this.state.isVisible;
    this.render();
  },

  render() {
    let widget = document.getElementById('timer-widget');

    if (!this.state.isVisible) {
      if (widget) widget.remove();
      return;
    }

    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'timer-widget';
      widget.className = 'timer-widget';
      document.body.appendChild(widget);
    }

    const minutes = Math.floor(this.state.secondsLeft / 60);
    const seconds = this.state.secondsLeft % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    widget.innerHTML = `
      <div class="timer-header">
        <span class="timer-mode-label">${this.state.mode === 'work' ? '🎯 Focus' : '☕ Break'}</span>
        <button id="timer-close-btn" class="timer-close-btn">✕</button>
      </div>
      <p class="timer-display">${display}</p>
      <div class="timer-controls">
        <button id="timer-start-pause-btn" class="btn btn-primary btn-sm-timer">
          ${this.state.isRunning ? 'Pause' : 'Start'}
        </button>
        <button id="timer-reset-btn" class="btn btn-secondary-sm">Reset</button>
      </div>
      <div class="timer-settings-row">
        <label>Focus <input type="number" id="timer-work-input" min="1" max="120" value="${this.state.workMinutes}" /> min</label>
        <label>Break <input type="number" id="timer-break-input" min="1" max="60" value="${this.state.breakMinutes}" /> min</label>
      </div>
    `;

    document.getElementById('timer-close-btn').addEventListener('click', () => this.toggleVisibility());
    document.getElementById('timer-start-pause-btn').addEventListener('click', () => this.toggleStartPause());
    document.getElementById('timer-reset-btn').addEventListener('click', () => this.reset());

    document.getElementById('timer-work-input').addEventListener('change', (e) => {
      this.state.workMinutes = parseInt(e.target.value, 10) || 25;
      if (this.state.mode === 'work' && !this.state.isRunning) {
        this.state.secondsLeft = this.state.workMinutes * 60;
        this.render();
      }
    });

    document.getElementById('timer-break-input').addEventListener('change', (e) => {
      this.state.breakMinutes = parseInt(e.target.value, 10) || 5;
      if (this.state.mode === 'break' && !this.state.isRunning) {
        this.state.secondsLeft = this.state.breakMinutes * 60;
        this.render();
      }
    });
  },

  toggleStartPause() {
    if (this.state.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    this.state.isRunning = true;
    this.state.intervalId = setInterval(() => this.tick(), 1000);
    this.render();
  },

  pause() {
    this.state.isRunning = false;
    clearInterval(this.state.intervalId);
    this.render();
  },

  reset() {
    this.pause();
    this.state.mode = 'work';
    this.state.secondsLeft = this.state.workMinutes * 60;
    this.render();
  },

  tick() {
    this.state.secondsLeft--;

    // Track focus minutes toward the daily goal, once per full minute of work time
    if (this.state.mode === 'work' && this.state.secondsLeft % 60 === 0) {
      Storage.addStudyMinutes(1);
    }

    if (this.state.secondsLeft <= 0) {
      this.switchMode();
    }

    // Only re-render the countdown text (avoid full re-render every second)
    const displayEl = document.querySelector('#timer-widget .timer-display');
    if (displayEl) {
      const minutes = Math.floor(this.state.secondsLeft / 60);
      const seconds = this.state.secondsLeft % 60;
      displayEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  },

  switchMode() {
    const nextMode = this.state.mode === 'work' ? 'break' : 'work';
    this.state.mode = nextMode;
    this.state.secondsLeft = (nextMode === 'work' ? this.state.workMinutes : this.state.breakMinutes) * 60;

    // Simple audible-ish alert since we have no notification system
    alert(nextMode === 'break' ? '🎯 Focus session done! Time for a break.' : '☕ Break over! Back to focus.');

    this.render();
  },
};