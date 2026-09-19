// js/gamification.js — Age-Adaptive Skins, XP & Retention Scores for Recallo

const Gamification = {
  KEY: 'recall_gamification',

  AGE_BRACKETS: {
    KIDS_EARLY: '3-6',    // Early Wonder: Picture MCQs, voice tone
    KIDS_QUEST: '6-12',   // Quest Mode: Gamified badges, XP, streaks
    TEENS: '12-19',       // Exam Gladiator: High-yield recall, timed challenges
    ADULTS: 'adults',     // Executive: Clean retention score, zero fluff
  },

  getState() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : this.getDefaultState();
    } catch {
      return this.getDefaultState();
    }
  },

  getDefaultState() {
    return {
      xp: 120,
      level: 1,
      streak: 1,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      ageBracket: '12-19', // Default to student/teen
      badges: [
        { id: 'first_recall', name: 'First Spark', icon: '⚡', unlocked: true, desc: 'Completed first active recall' },
        { id: 'streak_3', name: 'Memory Master', icon: '🧠', unlocked: false, desc: '3-day recall streak' },
        { id: 'pod_champ', name: 'Pod Gladiator', icon: '🏆', unlocked: false, desc: 'Won a group quiz battle' },
        { id: 'train_rider', name: 'Offline Voyager', icon: '🚆', unlocked: false, desc: 'Studied in Travel Mode' },
      ],
      retentionScore: 88, // Running comprehension % for adults
      questionsAnswered: 0,
      questionsCorrect: 0,
    };
  },

  saveState(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save gamification state:', e);
    }
  },

  setAgeBracket(bracket) {
    const state = this.getState();
    state.ageBracket = bracket;
    this.saveState(state);
    document.body.setAttribute('data-age-skin', bracket);
    window.dispatchEvent(new CustomEvent('recalio:age-changed', { detail: { ageBracket: bracket } }));
  },

  getAgeBracket() {
    return this.getState().ageBracket || '12-19';
  },

  addXP(amount, reason = '') {
    const state = this.getState();
    state.xp += amount;
    state.questionsAnswered++;
    state.questionsCorrect++;

    // Calculate level (every 250 XP is 1 level)
    const newLevel = Math.floor(state.xp / 250) + 1;
    const leveledUp = newLevel > state.level;
    state.level = newLevel;

    // Recalculate retention score
    state.retentionScore = Math.min(100, Math.round((state.questionsCorrect / Math.max(1, state.questionsAnswered)) * 100));

    this.saveState(state);
    this.showToast(`+${amount} XP ${reason ? '• ' + reason : ''}`);

    if (leveledUp) {
      this.showToast(`🎉 Level Up! You are now Level ${newLevel}!`, 'level-up');
    }

    window.dispatchEvent(new CustomEvent('recalio:xp-updated', { detail: state }));
    return state;
  },

  recordMistake() {
    const state = this.getState();
    state.questionsAnswered++;
    state.retentionScore = Math.max(40, Math.round((state.questionsCorrect / Math.max(1, state.questionsAnswered)) * 100));
    this.saveState(state);
    window.dispatchEvent(new CustomEvent('recalio:xp-updated', { detail: state }));
  },

  unlockBadge(badgeId) {
    const state = this.getState();
    const badge = state.badges.find((b) => b.id === badgeId);
    if (badge && !badge.unlocked) {
      badge.unlocked = true;
      this.saveState(state);
      this.showToast(`🏆 Badge Unlocked: ${badge.name}!`);
    }
  },

  showToast(text, type = 'normal') {
    let container = document.getElementById('recalio-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recalio-toast-container';
      container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `recalio-toast ${type}`;
    toast.style.cssText = `
      background: ${type === 'level-up' ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : '#1e1e24'};
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15);
      animation: slideInToast 0.3s ease forwards;
    `;
    toast.textContent = text;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  },
};

window.Gamification = Gamification;
