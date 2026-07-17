const Gemini = {
  // Calls our own serverless function instead of Google directly.
  // The API key is no longer here — it lives on the server now.
  FUNCTION_URL: '/.netlify/functions/gemini',

  async generateText(prompt, retriesLeft = 2) {
    try {
      const response = await fetch(this.FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: CONFIG.GEMINI_MODEL }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = data?.error || `Gemini API error: ${response.status}`;
        const isRateLimit = message === 'RATE_LIMIT';

        if (isRateLimit && retriesLeft > 0) {
          console.warn(`Gemini rate-limited, retrying in 5s... (${retriesLeft} retries left)`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return this.generateText(prompt, retriesLeft - 1);
        }

        throw new Error(isRateLimit ? 'RATE_LIMIT' : message);
      }

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