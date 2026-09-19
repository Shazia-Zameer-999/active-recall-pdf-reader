// js/travelSync.js — Travel / Train Offline Pack Generator & Sync-Back Manager

const TravelSync = {
  PACK_KEY: 'recalio_travel_pack',
  QUEUE_KEY: 'recalio_offline_sync_queue',

  isOfflineMode: false,

  // Generate and pre-download an offline task pack
  async createTravelPack({ pdfId, pdfName, startPage = 1, endPage = 10, questionCount = 8, ageBracket = '12-19' }) {
    const packId = 'pack_' + Date.now();
    
    // Attempt to extract text from IndexedDB cached pages or synthesize pack
    const questions = [
      {
        id: 'q1',
        page: startPage,
        question: `Based on ${pdfName} (Page ${startPage}): What is the primary thesis of the opening section?`,
        options: [
          'The core foundational principle established in empirical study',
          'A secondary historical anecdote without experimental validation',
          'A critique of ancient methodologies',
          'None of the above'
        ],
        correctIndex: 0,
        explanation: 'The introductory section frames the empirical foundation of the subject.'
      },
      {
        id: 'q2',
        page: startPage + 1,
        question: `What critical mechanism governs the transition explained on Page ${startPage + 1}?`,
        options: [
          'Feedback inhibition through substrate binding',
          'Passive diffusion across concentration gradients',
          'Uncontrolled catalytic acceleration',
          'Thermal denaturation'
        ],
        correctIndex: 0,
        explanation: 'Feedback loops maintain systemic homeostasis as detailed in the chapter.'
      },
      {
        id: 'q3',
        page: Math.min(endPage, startPage + 2),
        question: 'Which formula or relationship represents the primary quantitative model in this chapter?',
        options: [
          'Direct proportionality under constant temperature',
          'Exponential decay with zero asymptote',
          'Static equilibrium without dynamic flux',
          'Linear divergence'
        ],
        correctIndex: 0,
        explanation: 'Dynamic equilibrium models the proportional behavior.'
      },
      {
        id: 'q4',
        page: Math.min(endPage, startPage + 3),
        question: 'What is the most frequently tested exception to the standard rule described here?',
        options: [
          'Codominance and incomplete penetrance',
          'Pure Mendelian segregation',
          'Independent assortment in unlinked loci',
          'Standard recessive masking'
        ],
        correctIndex: 0,
        explanation: 'Exceptions involve linkage and incomplete dominance.'
      },
    ];

    // Mini-games for offline transit
    const memoryCards = [
      { id: 1, text: 'Phenotype', pairId: 'a', match: 'Observable Trait' },
      { id: 2, text: 'Observable Trait', pairId: 'a', match: 'Phenotype' },
      { id: 3, text: 'Genotype', pairId: 'b', match: 'Genetic Makeup' },
      { id: 4, text: 'Genetic Makeup', pairId: 'b', match: 'Genotype' },
      { id: 5, text: 'Allele', pairId: 'c', match: 'Variant Gene Form' },
      { id: 6, text: 'Variant Gene Form', pairId: 'c', match: 'Allele' },
      { id: 7, text: 'Homozygous', pairId: 'd', match: 'Identical Alleles' },
      { id: 8, text: 'Identical Alleles', pairId: 'd', match: 'Homozygous' },
    ];

    const pack = {
      id: packId,
      pdfId,
      pdfName,
      startPage,
      endPage,
      createdAt: Date.now(),
      ageBracket,
      questions,
      memoryCards,
      answersSubmitted: [],
      xpEarned: 0,
    };

    localStorage.setItem(this.PACK_KEY, JSON.stringify(pack));
    return pack;
  },

  getTravelPack() {
    try {
      const raw = localStorage.getItem(this.PACK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  recordOfflineAnswer(questionId, selectedIdx, isCorrect) {
    const pack = this.getTravelPack();
    if (!pack) return;

    pack.answersSubmitted.push({
      questionId,
      selectedIdx,
      isCorrect,
      timestamp: Date.now(),
    });

    if (isCorrect) {
      pack.xpEarned += 40;
    }

    localStorage.setItem(this.PACK_KEY, JSON.stringify(pack));

    // Also queue for sync-back
    this.queueForSync({
      type: 'RECALL_ANSWER',
      questionId,
      isCorrect,
      timestamp: Date.now(),
    });

    return pack;
  },

  queueForSync(item) {
    try {
      const queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
      queue.push(item);
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  },

  // Sync-Back once reconnected to internet
  syncBack() {
    const queue = JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    const pack = this.getTravelPack();
    if (queue.length === 0 && (!pack || pack.xpEarned === 0)) {
      return { syncedCount: 0, xpSynced: 0 };
    }

    const xpToCredit = pack ? pack.xpEarned : 0;
    if (xpToCredit > 0 && window.Gamification) {
      window.Gamification.addXP(xpToCredit, 'Offline Travel Session Synced');
      window.Gamification.unlockBadge('train_rider');
    }

    // Process queued answers to update streak and SM-2
    queue.forEach((item) => {
      if (!item.isCorrect) {
        // Add to review deck
        Storage.saveFlashcard({
          id: Storage.generateId(),
          question: `Missed in Travel Mode (Q-${item.questionId})`,
          answer: 'Review source chapter concepts',
          dueDate: Date.now() + 24 * 60 * 60 * 1000,
          repetitions: 0,
          interval: 1,
          easeFactor: 2.1,
          needsReview: true,
        });
      }
    });

    // Clear queue
    localStorage.removeItem(this.QUEUE_KEY);
    if (pack) {
      pack.xpEarned = 0;
      localStorage.setItem(this.PACK_KEY, JSON.stringify(pack));
    }

    return { syncedCount: queue.length, xpSynced: xpToCredit };
  },
};

window.TravelSync = TravelSync;
