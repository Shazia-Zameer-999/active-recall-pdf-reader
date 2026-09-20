const Gemini = {
  FUNCTION_URLS: ['/api/gemini', '/.netlify/functions/gemini'],

  async generateText(prompt, retriesLeft = 2) {
    let lastError = null;

    // Check if direct API key is configured (CONFIG or localStorage)
    const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null);

    if (apiKey) {
      try {
        const model = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_MODEL && CONFIG.GEMINI_MODEL.startsWith('gemini'))
          ? CONFIG.GEMINI_MODEL
          : 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const data = await res.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) return txt;
        if (data?.error) {
          console.warn('Direct Gemini API call returned error:', data.error);
        }
      } catch (e) {
        console.warn('Direct Gemini API call failed, falling back to function proxy:', e);
      }
    }

    for (const endpoint of this.FUNCTION_URLS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: typeof CONFIG !== 'undefined' ? CONFIG.GEMINI_MODEL : 'gemini-1.5-flash' }),
        });

        // Skip endpoint if missing (404) or static server doesn't allow POST (405)
        if (response.status === 404 || response.status === 405) {
          continue; // try next endpoint
        }

        const rawBody = await response.text();
        let data;
        try {
          data = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          continue;
        }

        if (!response.ok) {
          const message = data?.error || `Gemini API error: ${response.status}`;
          const isRateLimit = message === 'RATE_LIMIT';
          if (isRateLimit && retriesLeft > 0) {
            const waitTime = (3 - retriesLeft) * 3000 + 3000;
            console.warn(`Gemini temporarily unavailable, retrying in ${waitTime / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            return this.generateText(prompt, retriesLeft - 1);
          }
          throw new Error(isRateLimit ? 'Gemini is temporarily busy. Please try again in a moment.' : message);
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to communicate with AI endpoint.');
  },

  async generateJSON(prompt) {
    const jsonPrompt = `${prompt}\n\nRespond with ONLY valid JSON. No markdown formatting, no code fences, no explanation text before or after.`;
    const rawText = await this.generateText(jsonPrompt);
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Failed to parse Gemini JSON response:', cleaned);
      throw new Error('AI returned invalid JSON');
    }
  },

  async summarizeText(text) {
    const prompt = `You are a study assistant. Summarize the following text in clear,
concise bullet points, highlighting key concepts a student should remember.

Text:
"""${text}"""`;
    return this.generateText(prompt);
  },

  async generateFlashcards(text, count = 8) {
    const prompt = `Based on the following text, generate ${count} flashcards for
studying. Each flashcard should have a clear question and a concise answer.

Text:
"""${text}"""

Return a JSON array in this exact shape:
[{ "question": "...", "answer": "..." }]`;
    try {
      return await this.generateJSON(prompt);
    } catch (err) {
      console.warn('Gemini generateFlashcards failed, falling back to offline extraction:', err.message || err);
      return this.generateOfflineFlashcards(text, count);
    }
  },

  async generateMCQs(text, count = 5) {
    const prompt = `Based on the following text, generate ${count} multiple-choice
questions to test understanding.

Text:
"""${text}"""

Return a JSON array in this exact shape:
[{ "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }]`;
    try {
      return await this.generateJSON(prompt);
    } catch (err) {
      console.warn('Gemini generateMCQs failed, falling back to offline extraction:', err.message || err);
      return this.generateOfflineMCQs(text, count);
    }
  },

  generateOfflineFlashcards(text, count = 8) {
    const cleanText = (text || '').replace(/\s+/g, ' ').trim();
    const rawSentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    const sentences = rawSentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 25 && s.length <= 300);

    const cards = [];
    const definitionRegex = /^(?:The\s+|A\s+|An\s+)?([A-Z][a-zA-Z0-9\s'-]{2,35}?)\s+(?:is|are|refers to|is defined as|represents|means)\s+([^.]+)/i;

    for (const sentence of sentences) {
      if (cards.length >= count) break;
      const match = sentence.match(definitionRegex);
      if (match) {
        const concept = match[1].trim();
        const definition = match[2].trim();
        if (concept.length > 2 && definition.length > 8) {
          cards.push({
            question: `What is ${concept}?`,
            answer: sentence,
          });
        }
      }
    }

    for (const sentence of sentences) {
      if (cards.length >= count) break;
      if (!cards.some((c) => c.answer === sentence)) {
        const words = sentence.split(/\s+/);
        const keyWord = words.find((w) => w.length > 5 && /^[A-Z]/.test(w)) || words[0];
        cards.push({
          question: `Explain the concept of ${keyWord} discussed on this page.`,
          answer: sentence,
        });
      }
    }

    if (cards.length === 0) {
      cards.push({
        question: 'What is the core subject discussed in this excerpt?',
        answer: cleanText.slice(0, 200) || 'Review the source text for key concepts.',
      });
    }

    return cards;
  },

  generateOfflineMCQs(text, count = 5) {
    const cleanText = (text || '').replace(/\s+/g, ' ').trim();
    const rawSentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    const sentences = rawSentences
      .map((s) => s.trim())
      .filter((s) => s.length >= 25 && s.length <= 300);

    const questions = [];
    const definitionRegex = /^(?:The\s+|A\s+|An\s+)?([A-Z][a-zA-Z0-9\s'-]{2,35}?)\s+(?:is|are|refers to|is defined as|represents|means)\s+([^.]+)/i;

    for (const sentence of sentences) {
      if (questions.length >= count) break;
      const match = sentence.match(definitionRegex);
      if (match) {
        const concept = match[1].trim();
        const correctAnswer = match[2].trim().charAt(0).toUpperCase() + match[2].trim().slice(1);

        const distractors = sentences
          .filter((s) => s !== sentence)
          .map((s) => {
            const m = s.match(definitionRegex);
            if (m) return m[2].trim().charAt(0).toUpperCase() + m[2].trim().slice(1);
            const trimmed = s.slice(0, 85).replace(/\s+\S*$/, '').trim();
            return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : s.slice(0, 40);
          })
          .filter((d) => d && d !== correctAnswer)
          .slice(0, 3);

        while (distractors.length < 3) {
          distractors.push(
            distractors.length === 0
              ? 'An unrelated peripheral mechanism'
              : distractors.length === 1
              ? 'Inverts the primary principle described'
              : 'Has no direct relationship to this function'
          );
        }

        const options = [correctAnswer, ...distractors.slice(0, 3)];
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }

        questions.push({
          question: `Which of the following best defines or describes "${concept}"?`,
          options,
          correctIndex: options.indexOf(correctAnswer),
          explanation: sentence,
        });
      }
    }

    for (const sentence of sentences) {
      if (questions.length >= count) break;
      const words = sentence.split(/\s+/).filter((w) => w.length > 5 && /^[a-zA-Z]+$/.test(w));
      if (words.length > 0) {
        const targetWord = words[0];
        const blanked = sentence.replace(new RegExp(`\\b${targetWord}\\b`, 'i'), '________');
        const options = [targetWord, words[1] || 'alternative', 'parameter', 'constant'];
        const uniqueOpts = Array.from(new Set(options));
        while (uniqueOpts.length < 4) uniqueOpts.push(`factor_${uniqueOpts.length}`);

        for (let i = uniqueOpts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [uniqueOpts[i], uniqueOpts[j]] = [uniqueOpts[j], uniqueOpts[i]];
        }

        questions.push({
          question: `Complete the key statement from the text: "${blanked.slice(0, 150)}..."`,
          options: uniqueOpts,
          correctIndex: uniqueOpts.indexOf(targetWord),
          explanation: sentence,
        });
      }
    }

    if (questions.length === 0) {
      questions.push({
        question: 'What is the primary theme highlighted in this reading material?',
        options: [
          'The core foundational concepts and principles',
          'Historical background with no modern relevance',
          'Unverified conjectures and hypotheses',
          'Opposing viewpoints without evidence',
        ],
        correctIndex: 0,
        explanation: 'The excerpt highlights foundational principles and key definitions.',
      });
    }

    return questions;
  },
};
