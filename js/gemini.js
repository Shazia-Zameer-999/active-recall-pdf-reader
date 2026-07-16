const Gemini = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',

  async generateText(prompt) {
   const model = CONFIG.GEMINI_MODEL || 'gemini-3.5-flash';
    const url = `${this.BASE_URL}/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error?.message || `Gemini API error: ${response.status}`);
      }

      const data = await response.json();
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