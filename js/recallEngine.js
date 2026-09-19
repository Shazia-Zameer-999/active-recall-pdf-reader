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
      console.warn('RecallEngine Gemini JSON generation failed, falling back to flashcard extraction:', err);
      // Fallback to flashcard format
      const cards = await Gemini.generateFlashcards(pageText, 1);
      const card = cards[0] || { question: 'What was the main topic on this page?', answer: 'Check source text.' };
      return {
        summary: 'Review the text you just read and recall the central definition.',
        question: card.question,
        options: null, // text area mode
        correctIndex: -1,
        answer: card.answer,
        keyConcept: 'General Recall',
        pageNumber,
        pageText,
        difficulty: 'standard',
      };
    }
  },
};

window.RecallEngine = RecallEngine;
