const OCR = {
  worker: null,
  isInitializing: false,

  // Creates the Tesseract worker once and reuses it for every OCR call
  async getWorker() {
    if (this.worker) return this.worker;

    // Prevent creating multiple workers if called again while one is still initializing
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.worker;
    }

    this.isInitializing = true;
    try {
      this.worker = await Tesseract.createWorker('eng');
      return this.worker;
    } finally {
      this.isInitializing = false;
    }
  },

  // Runs OCR on a canvas element (e.g. an already-rendered PDF page) and returns the text
  async recognizeCanvas(canvas) {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(canvas);
    return data.text;
  },
};