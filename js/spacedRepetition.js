const SpacedRepetition = {
  // Simplified SM-2 algorithm. rating: 0=Again, 1=Hard, 2=Good, 3=Easy
  review(card, rating) {
    let interval = card.interval || 0;
    let easeFactor = card.easeFactor || 2.5;
    let repetitions = card.repetitions || 0;

    if (rating === 0) {
      // "Again" — reset progress, review tomorrow
      repetitions = 0;
      interval = 1;
    } else {
      repetitions += 1;
      if (repetitions === 1) interval = 1;
      else if (repetitions === 2) interval = 6;
      else interval = Math.round(interval * easeFactor);

      easeFactor = easeFactor + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;
    }

    const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000;

    return {
      ...card,
      interval,
      easeFactor,
      repetitions,
      dueDate,
      lastReviewedAt: Date.now(),
    };
  },

  // Cards with no dueDate yet (brand new) count as due immediately
  getDueCards(cards) {
    const now = Date.now();
    return cards.filter((c) => !c.dueDate || c.dueDate <= now);
  },

  // Returns { 'YYYY-MM-DD': countDueOnThatDay } for the next N days
  getUpcoming(cards, days = 14) {
    const map = {};
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      map[d.toISOString().slice(0, 10)] = 0;
    }

    cards.forEach((c) => {
      if (!c.dueDate) return;
      const key = new Date(c.dueDate).toISOString().slice(0, 10);
      if (map[key] !== undefined) map[key]++;
    });

    return map;
  },
};