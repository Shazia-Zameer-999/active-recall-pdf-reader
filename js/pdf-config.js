// Lazily injects PDF.js from the CDN the first time it's needed, and only once.
// Returns a promise that resolves once window.pdfjsLib is ready to use.
const loadPdfJs = (() => {
  let promise = null;
  return function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (promise) return promise;

    promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
      script.onload = () => {
        // workerSrc is only set AFTER pdfjsLib actually exists — this is what
        // avoids the old "Uncaught ReferenceError: pdfjsLib is not defined".
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        promise = null; // allow a retry on the next call instead of permanently failing
        reject(new Error('Failed to load PDF.js from CDN'));
      };
      document.head.appendChild(script);
    });

    return promise;
  };
})();