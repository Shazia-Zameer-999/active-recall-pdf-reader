const Gemini = {
  FUNCTION_URLS: ['/.netlify/functions/gemini', '/api/gemini'],

  async generateText(prompt, retriesLeft = 2) {
    let lastError = null;

    // Check if direct API key is configured
    if (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) {
      try {
        const model = CONFIG.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const data = await res.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) return txt;
      } catch (e) {
        console.warn('Direct Gemini API call failed, falling back to function proxy:', e);
      }
    }

    for (const endpoint of this.FUNCTION_URLS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: CONFIG.GEMINI_MODEL }),
        });

        if (response.status === 404) {
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
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return this.generateText(prompt, retriesLeft - 1);
          }
          throw new Error(isRateLimit ? 'RATE_LIMIT' : message);
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to communicate with AI endpoint.');
  },

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned an empty response');
      return text;
    } catch (error) {
      console.error('Gemini generateText failed:', error);
      throw error;
    }
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
    return this.generateJSON(prompt);
  },

  async generateMCQs(text, count = 5) {
    const prompt = `Based on the following text, generate ${count} multiple-choice
questions to test understanding.

Text:
"""${text}"""

Return a JSON array in this exact shape:
[{ "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }]`;
    return this.generateJSON(prompt);
  },
};