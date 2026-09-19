const OCR = {
  worker: null,
  isInitializing: false,
  _scriptPromise: null,

  // Lazily injects Tesseract.js from the CDN the first time it's needed, and only once
  loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve();
    if (this._scriptPromise) return this._scriptPromise;

    this._scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => resolve();
      script.onerror = () => {
        this._scriptPromise = null;
        reject(new Error('Failed to load Tesseract.js from CDN'));
      };
      document.head.appendChild(script);
    });

    return this._scriptPromise;
  },

  async getWorker() {
    if (this.worker) return this.worker;

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.worker;
    }

    this.isInitializing = true;
    try {
      await this.loadTesseractScript();
      this.worker = await Tesseract.createWorker('eng');
      return this.worker;
    } finally {
      this.isInitializing = false;
    }
  },

  async recognizeCanvas(canvas) {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(canvas);
    return data.text;
  },
};