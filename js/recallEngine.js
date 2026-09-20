// js/recallEngine.js — Core Adaptive Chunk-Recall Engine for Recallo
// Powers in-flow gating, 2-line recaps, grounded question generation, and adaptive difficulty scaling.

const RecallEngine = {
  currentChunkInterval: 2, // Adaptive: starts at 2 pages, expands on mastery
  consecutiveCorrect: 0,
  minInterval: 1,
  maxInterval: 8,

  // Reset or initialize for a specific document
  init(pdfId) {
    this.consecutiveCorrect = 0;
    const settings = Storage.getSettings();
    const configured = parseInt(settings.recallFrequencyPages, 10);
    this.currentChunkInterval = isNaN(configured) ? 2 : configured;
  },

  // Called when user answers a recall checkpoint
  recordAttempt({ question, userAnswer, correctAnswer, wasCorrect, pageNumber, pageText, difficulty = 'medium' }) {
    if (wasCorrect) {
      this.consecutiveCorrect++;
      // Adaptive pacing: If student gets 2 in a row right, expand reading interval
      if (this.consecutiveCorrect >= 2 && this.currentChunkInterval < this.maxInterval) {
        this.currentChunkInterval = Math.min(this.maxInterval, this.currentChunkInterval + 2);
        this.consecutiveCorrect = 0;
      }
      // Gamification reward
      if (window.Gamification) {
        window.Gamification.addXP(50, `Recalled Page ${pageNumber}`);
      }
    } else {
      this.consecutiveCorrect = 0;
      // Adaptive pacing: On mistake, tighten interval for closer retention support
      this.currentChunkInterval = Math.max(this.minInterval, 2);

      // Auto-bridge to Spaced Repetition queue
      const flashcard = {
        id: Storage.generateId(),
        question,
        answer: correctAnswer,
        pageNumber,
        sourceSnippet: pageText ? pageText.slice(0, 300) : '',
        interval: 1,
        easeFactor: 2.0,
        repetitions: 0,
        dueDate: Date.now() + 24 * 60 * 60 * 1000, // Due tomorrow
        createdAt: Date.now(),
        needsReview: true,
      };
      Storage.saveFlashcard(flashcard);
    }

    return {
      wasCorrect,
      newInterval: this.currentChunkInterval,
      consecutiveCorrect: this.consecutiveCorrect,
    };
  },

  // Generate a structured checkpoint: 2-line summary + question + options
  async generateCheckpoint(pageText, pageNumber, retryEasier = false) {
    if (!pageText || pageText.trim().length < 30) {
      throw new Error('Page content insufficient for recall generation');
    }

    const difficultyInstruction = retryEasier
      ? 'Generate a simpler, high-yield fundamental recall question with clear clues.'
      : 'Generate an engaging conceptual question to test active recall.';

    const prompt = `You are RecalIo's Active Recall Engine. Analyze this textbook page excerpt:
"""${pageText.slice(0, 2000)}"""

${difficultyInstruction}

Respond with ONLY valid JSON in this exact structure (no code blocks, no explanation text):
{
  "summary": "A crisp 2-line summary highlighting the most critical takeaway from this text.",
  "question": "Clear, grounded question testing memory of the key concept.",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "answer": "The exact correct answer explanation in 1 concise sentence.",
  "keyConcept": "Name of the core concept (e.g. Newton's 2nd Law, Mitochondria)"
}`;

    try {
      const data = await Gemini.generateJSON(prompt);
      if (!data || !data.question) {
        throw new Error('Invalid checkpoint response');
      }
      return {
        ...data,
        pageNumber,
        pageText,
        difficulty: retryEasier ? 'easy' : 'standard',
      };
    } catch (err) {
      console.warn('RecallEngine Gemini JSON generation failed, falling back to offline heuristic checkpoint:', err);
      return this.generateHeuristicCheckpoint(pageText, pageNumber, retryEasier);
    }
  },

  // Fully offline, zero-dependency heuristic checkpoint generator (Train Mode / Offline Gating)
  generateHeuristicCheckpoint(pageText, pageNumber, retryEasier = false) {
    const cleanText = (pageText || '').replace(/\s+/g, ' ').trim();
    const rawSentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    const sentences = rawSentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 25 && s.length <= 300);

    // Form a crisp 2-line summary from top conceptual sentences
    const keywordSentences = sentences.filter((s) =>
      /\b(is|are|defined|means|function|principle|law|process|structure|method|theorem|key|important|primary|role)\b/i.test(s)
    );
    const summarySentences = (keywordSentences.length >= 2 ? keywordSentences : sentences).slice(0, 2);
    const summary =
      summarySentences.join(' ').slice(0, 220).trim() ||
      'Review the core ideas, definitions, and relationships outlined on this page.';

    // Look for a clean definition or statement
    const definitionRegex =
      /^(?:The\s+|A\s+|An\s+)?([A-Z][a-zA-Z0-9\s'-]{2,35}?)\s+(?:is|are|refers to|is defined as|represents|means)\s+([^.]+)/i;
    let chosenSentence = sentences.find((s) => definitionRegex.test(s));
    let match = chosenSentence ? chosenSentence.match(definitionRegex) : null;

    if (match) {
      const keyConcept = match[1].trim();
      const rawDef = match[2].trim();
      const correctAnswer = rawDef.charAt(0).toUpperCase() + rawDef.slice(1);

      // Collect distractors
      const distractors = sentences
        .filter((s) => s !== chosenSentence)
        .map((s) => {
          const m = s.match(definitionRegex);
          return m ? m[2].trim().charAt(0).toUpperCase() + m[2].trim().slice(1) : s.slice(0, 70);
        })
        .filter((d) => d && d !== correctAnswer)
        .slice(0, 3);

      while (distractors.length < 3) {
        distractors.push(
          distractors.length === 0
            ? 'Acts as a secondary, non-essential variable'
            : distractors.length === 1
            ? 'Inversely related to the primary system mechanism'
            : 'Unrelated to the principle described on this page'
        );
      }

      const options = [correctAnswer, ...distractors.slice(0, 3)];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const question = retryEasier
        ? `What is the fundamental role or definition of "${keyConcept}"?`
        : `According to Page ${pageNumber}, which of the following correctly describes "${keyConcept}"?`;

      return {
        summary,
        question,
        options,
        correctIndex: options.indexOf(correctAnswer),
        answer: chosenSentence,
        keyConcept,
        pageNumber,
        pageText,
        difficulty: retryEasier ? 'easy' : 'standard',
      };
    }

    // Secondary heuristic: fill in the blank
    const candidateSentence = sentences.find((s) => s.length > 50 && s.length < 180) || sentences[0];
    if (candidateSentence) {
      const words = candidateSentence.split(/\s+/).filter((w) => w.length > 5 && /^[a-zA-Z]+$/.test(w));
      if (words.length > 0) {
        const targetWord = words[0];
        const blanked = candidateSentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), '________');
        const keyConcept = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);

        const options = [targetWord, words[1] || 'alternative', 'hypothesis', 'constant'];
        const uniqueOpts = Array.from(new Set(options));
        while (uniqueOpts.length < 4) uniqueOpts.push(`factor_${uniqueOpts.length}`);

        for (let i = uniqueOpts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [uniqueOpts[i], uniqueOpts[j]] = [uniqueOpts[j], uniqueOpts[i]];
        }

        return {
          summary,
          question: `Complete the key statement from Page ${pageNumber}: "${blanked.slice(0, 160)}..."`,
          options: uniqueOpts,
          correctIndex: uniqueOpts.indexOf(targetWord),
          answer: `The correct term is "${targetWord}" as stated: "${candidateSentence}"`,
          keyConcept,
          pageNumber,
          pageText,
          difficulty: retryEasier ? 'easy' : 'standard',
        };
      }
    }

    // Tertiary heuristic: text recall prompt
    return {
      summary,
      question: `In 1-2 concise sentences, recall the main concept or formula explained on Page ${pageNumber}.`,
      options: null,
      correctIndex: -1,
      answer: `Key insight from Page ${pageNumber}: "${cleanText.slice(0, 200)}..."`,
      keyConcept: 'Active Retrieval',
      pageNumber,
      pageText,
      difficulty: retryEasier ? 'easy' : 'standard',
    };
  },
};

window.RecallEngine = RecallEngine;
