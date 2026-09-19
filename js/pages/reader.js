window.Pages.Reader = {
  state: {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.2,
    pdfId: null,
    pdfName: '',
    viewMode: 'original', // 'original' | 'reflow'
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 1.7,
    readerTheme: 'light', // light | sepia | dark | oled
    currentPageText: '',
  },

  render() {
    return `
      <div class="reader-page">
        <div class="reader-toolbar">
          <button id="prev-page-btn" class="icon-btn" title="Previous page">◀</button>
          <span class="page-indicator">
            <input type="number" id="page-input" class="page-input" min="1" value="1" />
            / <span id="total-pages">-</span>
          </span>
          <button id="next-page-btn" class="icon-btn" title="Next page">▶</button>

          <span class="toolbar-divider"></span>

          <!-- View Mode Toggle (Original vs Designer Reflow) -->
          <button id="toggle-view-mode-btn" class="btn btn-secondary-sm" title="Toggle between Original PDF and Designer Reflow Mode">
            ✨ Designer View
          </button>

          <!-- Kindle-style 'Aa' Typography & Theme Menu -->
          <div class="reader-aa-menu">
            <button id="aa-menu-btn" class="icon-btn" title="Typography & Theme (Aa)" style="font-weight: 800;">Aa</button>
            <div id="aa-dropdown" class="reader-aa-dropdown" style="display: none;">
              <div class="aa-section-title">Font Family</div>
              <div class="aa-btn-group">
                <button class="aa-choice-btn active" data-font="Inter">Sans</button>
                <button class="aa-choice-btn" data-font="Georgia">Serif</button>
                <button class="aa-choice-btn" data-font="JetBrains Mono">Mono</button>
              </div>

              <div class="aa-section-title" style="margin-top: 6px;">Font Size</div>
              <div class="aa-btn-group">
                <button class="aa-choice-btn" data-size="14">Small</button>
                <button class="aa-choice-btn active" data-size="16">Default</button>
                <button class="aa-choice-btn" data-size="19">Large</button>
                <button class="aa-choice-btn" data-size="22">XL</button>
              </div>

              <div class="aa-section-title" style="margin-top: 6px;">Reading Theme</div>
              <div class="theme-swatches">
                <button class="theme-swatch-btn theme-light active" data-theme="light">Light</button>
                <button class="theme-swatch-btn theme-sepia" data-theme="sepia">Sepia</button>
                <button class="theme-swatch-btn theme-dark" data-theme="dark">Dark</button>
                <button class="theme-swatch-btn theme-oled" data-theme="oled">OLED</button>
              </div>
            </div>
          </div>

          <span class="toolbar-divider"></span>

          <!-- Recall Checkpoint Frequency Selector -->
          <select id="recall-freq-select" class="page-input" style="width: auto; font-size: 0.8rem; font-weight: 600;" title="Active Recall Frequency">
            <option value="2">Recall: Every 2 Pages</option>
            <option value="5" selected>Recall: Every 5 Pages</option>
            <option value="10">Recall: Every 10 Pages</option>
            <option value="manual">Recall: Manual Only</option>
          </select>

          <!-- Instant Checkpoint Button -->
          <button id="trigger-checkpoint-btn" class="btn btn-secondary-sm" title="Trigger instant recall challenge" style="color: var(--accent); font-weight: 700;">
            ⚡ Checkpoint
          </button>

          <span class="toolbar-divider"></span>

          <button id="zoom-out-btn" class="icon-btn" title="Zoom out">−</button>
          <span id="zoom-level">120%</span>
          <button id="zoom-in-btn" class="icon-btn" title="Zoom in">+</button>
          <button id="fit-width-btn" class="btn btn-secondary-sm" title="Fit width">Fit Width</button>

          <span class="toolbar-divider"></span>

          <button id="bookmark-page-btn" class="btn btn-secondary-sm" title="Bookmark this page">🔖 Bookmark</button>
        </div>

        <div class="annotation-toolbar" id="annotation-toolbar">
          <button id="tool-none-btn" class="ann-tool-btn active" data-tool="none">🖱️ Select</button>
          <button id="tool-highlight-btn" class="ann-tool-btn" data-tool="highlight">🖍️ Highlight</button>
          <button id="tool-underline-btn" class="ann-tool-btn" data-tool="underline">🔤 Underline</button>
          <button id="tool-draw-btn" class="ann-tool-btn" data-tool="draw">✏️ Draw</button>
          <button id="tool-sticky-btn" class="ann-tool-btn" data-tool="sticky">📌 Sticky Note</button>

          <span class="toolbar-divider"></span>

          <div class="color-swatches">
            <button class="color-swatch active" data-color="#ffeb3b" style="background:#ffeb3b"></button>
            <button class="color-swatch" data-color="#69f0ae" style="background:#69f0ae"></button>
            <button class="color-swatch" data-color="#ff8a80" style="background:#ff8a80"></button>
            <button class="color-swatch" data-color="#82b1ff" style="background:#82b1ff"></button>
            <button class="color-swatch" data-color="#ffab40" style="background:#ffab40"></button>
            <button class="color-swatch" data-color="#ea80fc" style="background:#ea80fc"></button>
            <button class="color-swatch" data-color="#b388ff" style="background:#b388ff"></button>
            <button class="color-swatch" data-color="#80d8ff" style="background:#80d8ff"></button>
          </div>

          <span class="toolbar-divider"></span>

          <button id="export-annotations-btn" class="btn btn-secondary-sm">Export Annotations</button>
        </div>

        <div class="reader-body">
          <div id="reader-canvas-container" class="reader-canvas-container">
            <p class="placeholder-content">Loading PDF...</p>
          </div>

          <div class="annotations-panel" id="annotations-panel">
            <h4>Annotations on this page</h4>
            <div id="annotations-panel-list"></div>
          </div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    const id = Router.getQueryParam('id');
    const canvasContainer = document.getElementById('reader-canvas-container');

    if (!id) {
      canvasContainer.innerHTML = `<div class="empty-state"><p>No PDF selected. Go to the Library and pick one.</p></div>`;
      return;
    }

    this.state.pdfId = id;
    ActiveRecall.init(id);

    const record = await DB.getPDF(id);
    if (!record) {
      canvasContainer.innerHTML = `<div class="empty-state"><p>PDF not found. It may have been deleted.</p></div>`;
      return;
    }

    this.state.pdfName = record.name;
    const arrayBuffer = await record.file.arrayBuffer();

    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      this.state.pdfDoc = await loadingTask.promise;
      this.state.totalPages = this.state.pdfDoc.numPages;

      // Page Memory (Feature 6: Resume Reading)
      const requestedPage = parseInt(Router.getQueryParam('page'), 10);
      let targetPage = 1;
      if (requestedPage && requestedPage <= this.state.totalPages) {
        targetPage = requestedPage;
      } else {
        // Look up reading history to resume
        const history = Storage.getReadingHistory().find((h) => h.pdfId === id);
        if (history && history.currentPage && history.currentPage <= this.state.totalPages) {
          targetPage = history.currentPage;
        }
      }
      this.state.currentPage = targetPage;

      document.getElementById('total-pages').textContent = this.state.totalPages;
      document.getElementById('page-input').max = this.state.totalPages;
      document.getElementById('page-input').value = targetPage;

      this.attachToolbarListeners();
      this.attachAnnotationToolbarListeners();
      this.attachAaMenuListeners();
      this.attachViewModeListeners();

      await this.fitToWidth();
    } catch (error) {
      console.error('Failed to load PDF:', error);
      canvasContainer.innerHTML = `<div class="empty-state"><p>Couldn't load this PDF. It may be corrupted.</p></div>`;
    }
  },

  async fitToWidth() {
    if (this.state.viewMode === 'reflow') {
      await this.renderPage(this.state.currentPage);
      return;
    }

    const page = await this.state.pdfDoc.getPage(this.state.currentPage);
    const containerWidth = document.getElementById('reader-canvas-container').clientWidth - 40;
    const unscaledViewport = page.getViewport({ scale: 1 });
    this.state.scale = containerWidth / unscaledViewport.width;
    document.getElementById('zoom-level').textContent = `${Math.round(this.state.scale * 100)}%`;
    await this.renderPage(this.state.currentPage);
  },

  async renderPage(pageNumber) {
    const canvasContainer = document.getElementById('reader-canvas-container');
    const annToolbar = document.getElementById('annotation-toolbar');
    const annPanel = document.getElementById('annotations-panel');

    const page = await this.state.pdfDoc.getPage(pageNumber);

    // Extract page text
    const textContent = await page.getTextContent();
    let pageText = textContent.items.map((item) => item.str).join(' ');

    // Handle OCR fallback for scanned pages
    if (pageText.trim().length < 40) {
      const cached = Storage.getCachedOcrText(this.state.pdfId, pageNumber);
      if (cached) {
        pageText = cached;
      } else {
        this.showOcrIndicator(true);
        try {
          // Render to offscreen canvas for OCR
          const viewport = page.getViewport({ scale: 1.5 });
          const offCanvas = document.createElement('canvas');
          offCanvas.width = viewport.width;
          offCanvas.height = viewport.height;
          await page.render({ canvasContext: offCanvas.getContext('2d'), viewport }).promise;
          pageText = await OCR.recognizeCanvas(offCanvas);
          Storage.setCachedOcrText(this.state.pdfId, pageNumber, pageText);
        } catch (err) {
          console.error('OCR failed:', err);
        } finally {
          this.showOcrIndicator(false);
        }
      }
    }

    this.state.currentPageText = pageText;

    // Feature 5: Designer View / Reflow Mode
    if (this.state.viewMode === 'reflow') {
      if (annToolbar) annToolbar.style.display = 'none';
      if (annPanel) annPanel.style.display = 'none';

      const formattedParagraphs = (pageText || 'No text extracted from this page.')
        .split(/(?<=[.?!])\s+/)
        .map((p) => `<p style="margin-bottom: 1em;">${p}</p>`)
        .join('');

      canvasContainer.innerHTML = `
        <div class="designer-reflow-view theme-${this.state.readerTheme}">
          <div class="designer-reflow-header">
            <span><strong>${this.state.pdfName}</strong> — Page ${pageNumber} / ${this.state.totalPages}</span>
            <span style="font-weight: 700; color: var(--accent);">✨ Designer View</span>
          </div>
          <div class="designer-reflow-body" style="font-family: ${this.state.fontFamily}; font-size: ${this.state.fontSize}px; line-height: ${this.state.lineHeight};">
            ${formattedParagraphs}
          </div>
        </div>
      `;
    } else {
      // Original View (Canvas + Annotations)
      if (annToolbar) annToolbar.style.display = 'flex';
      if (annPanel) annPanel.style.display = 'block';

      const viewport = page.getViewport({ scale: this.state.scale });

      canvasContainer.innerHTML = `
        <div id="pdf-page-wrapper" class="pdf-page-wrapper" style="width:${viewport.width}px; height:${viewport.height}px;">
          <canvas id="pdf-canvas"></canvas>
          <canvas id="annotation-canvas" class="annotation-canvas"></canvas>
          <div id="text-layer" class="textLayer"></div>
          <div id="sticky-layer" class="sticky-layer"></div>
        </div>
      `;

      const outputScale = window.devicePixelRatio || 1;
      const canvas = document.getElementById('pdf-canvas');
      const context = canvas.getContext('2d');

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const overlayCanvas = document.getElementById('annotation-canvas');
      overlayCanvas.width = viewport.width;
      overlayCanvas.height = viewport.height;
      overlayCanvas.style.width = `${viewport.width}px`;
      overlayCanvas.style.height = `${viewport.height}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      await page.render({ canvasContext: context, viewport, transform }).promise;

      Annotations.init(this.state.pdfId, pageNumber, this.state.scale);
      await Annotations.renderTextLayer(page, viewport);
      Annotations.attachDrawListeners();
      Annotations.attachStickyListener();
      Annotations.updateLayerInteractivity();
      Annotations.renderAll();
    }

    // Save reading progress (Feature 6)
    Storage.updateReadingProgress(this.state.pdfId, pageNumber, this.state.totalPages);

    // Sync to Study Pod if in active group room (Feature 15)
    if (window.GroupRoom && window.GroupRoom.activeRoom) {
      window.GroupRoom.updateProgress(pageNumber);
    }

    // In-Flow Active Recall Checkpoint (Feature 1 & 2)
    ActiveRecall.onPageRead(pageText, pageNumber);
  },

  showOcrIndicator(show) {
    let indicator = document.getElementById('ocr-indicator');
    if (show) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'ocr-indicator';
        indicator.className = 'ocr-indicator';
        indicator.textContent = '🔍 Reading scanned/handwritten text...';
        document.body.appendChild(indicator);
      }
    } else {
      if (indicator) indicator.remove();
    }
  },

  attachAaMenuListeners() {
    const aaBtn = document.getElementById('aa-menu-btn');
    const aaDropdown = document.getElementById('aa-dropdown');

    if (aaBtn && aaDropdown) {
      aaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = aaDropdown.style.display === 'flex';
        aaDropdown.style.display = isOpen ? 'none' : 'flex';
      });

      document.addEventListener('click', (e) => {
        if (!aaDropdown.contains(e.target) && e.target !== aaBtn) {
          aaDropdown.style.display = 'none';
        }
      });

      // Font Family
      aaDropdown.querySelectorAll('[data-font]').forEach((btn) => {
        btn.addEventListener('click', () => {
          aaDropdown.querySelectorAll('[data-font]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.fontFamily = btn.getAttribute('data-font');
          if (this.state.viewMode === 'reflow') this.renderPage(this.state.currentPage);
        });
      });

      // Font Size
      aaDropdown.querySelectorAll('[data-size]').forEach((btn) => {
        btn.addEventListener('click', () => {
          aaDropdown.querySelectorAll('[data-size]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.fontSize = parseInt(btn.getAttribute('data-size'), 10);
          if (this.state.viewMode === 'reflow') this.renderPage(this.state.currentPage);
        });
      });

      // Reading Themes (Light, Sepia, Dark, OLED)
      aaDropdown.querySelectorAll('[data-theme]').forEach((btn) => {
        btn.addEventListener('click', () => {
          aaDropdown.querySelectorAll('[data-theme]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.readerTheme = btn.getAttribute('data-theme');
          if (this.state.viewMode === 'reflow') this.renderPage(this.state.currentPage);
        });
      });
    }
  },

  attachViewModeListeners() {
    const toggleBtn = document.getElementById('toggle-view-mode-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.state.viewMode = this.state.viewMode === 'original' ? 'reflow' : 'original';
        toggleBtn.textContent = this.state.viewMode === 'reflow' ? '📄 Original View' : '✨ Designer View';
        toggleBtn.classList.toggle('btn-primary', this.state.viewMode === 'reflow');
        this.renderPage(this.state.currentPage);
      });
    }

    // Checkpoint Frequency Selector
    const freqSelect = document.getElementById('recall-freq-select');
    if (freqSelect) {
      const settings = Storage.getSettings();
      if (settings.recallFrequencyPages) {
        freqSelect.value = settings.recallFrequencyPages;
      }
      freqSelect.addEventListener('change', (e) => {
        settings.recallFrequencyPages = e.target.value;
        Storage.saveSettings(settings);
      });
    }

    // Trigger Instant Checkpoint Button
    const triggerBtn = document.getElementById('trigger-checkpoint-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        ActiveRecall.showPrompt(this.state.currentPageText, this.state.currentPage);
      });
    }
  },

  attachAnnotationToolbarListeners() {
    document.querySelectorAll('.ann-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ann-tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        Annotations.setTool(btn.getAttribute('data-tool'));
      });
    });

    document.querySelectorAll('.annotation-toolbar .color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.annotation-toolbar .color-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        Annotations.setColor(btn.getAttribute('data-color'));
      });
    });

    document.getElementById('export-annotations-btn').addEventListener('click', () => {
      Annotations.exportAnnotations(this.state.pdfId, this.state.pdfName);
    });
  },

  attachToolbarListeners() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageInput = document.getElementById('page-input');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const fitWidthBtn = document.getElementById('fit-width-btn');
    const zoomLevelEl = document.getElementById('zoom-level');

    prevBtn.addEventListener('click', () => this.goToPage(this.state.currentPage - 1));
    nextBtn.addEventListener('click', () => {
      // Feature 2: Gated difficulty check
      if (ActiveRecall.isGatedLocked) {
        ActiveRecall.showPrompt(this.state.currentPageText, this.state.currentPage);
        return;
      }
      this.goToPage(this.state.currentPage + 1);
    });

    pageInput.addEventListener('change', (e) => {
      const pageNum = parseInt(e.target.value, 10);
      if (!isNaN(pageNum)) this.goToPage(pageNum);
    });

    zoomInBtn.addEventListener('click', () => {
      this.state.scale = Math.min(this.state.scale + 0.2, 3);
      zoomLevelEl.textContent = `${Math.round(this.state.scale * 100)}%`;
      this.renderPage(this.state.currentPage);
    });

    zoomOutBtn.addEventListener('click', () => {
      this.state.scale = Math.max(this.state.scale - 0.2, 0.4);
      zoomLevelEl.textContent = `${Math.round(this.state.scale * 100)}%`;
      this.renderPage(this.state.currentPage);
    });

    fitWidthBtn.addEventListener('click', () => this.fitToWidth());
    document.getElementById('bookmark-page-btn').addEventListener('click', () => this.showBookmarkPopup());
  },

  showBookmarkPopup() {
    const bookmarks = Storage.getBookmarks();
    const existingFolders = [...new Set(bookmarks.map((b) => b.folder))].filter(Boolean);

    const overlay = document.createElement('div');
    overlay.id = 'bookmark-popup-overlay';
    overlay.className = 'recall-modal-overlay';

    overlay.innerHTML = `
      <div class="recall-modal">
        <h3 class="recall-question">Bookmark Page ${this.state.currentPage}</h3>
        <label class="settings-label">Label (optional)</label>
        <input type="text" id="bookmark-label-input" class="manual-form-input" placeholder="e.g. Important formula" />
        <label class="settings-label" style="margin-top: 12px; display: block;">Folder</label>
        <input type="text" id="bookmark-folder-input" class="manual-form-input" placeholder="e.g. Exam Prep" list="folder-suggestions" />
        <datalist id="folder-suggestions">
          ${existingFolders.map((f) => `<option value="${f}">`).join('')}
        </datalist>
        <div class="recall-actions" style="margin-top: 16px;">
          <button id="bookmark-cancel-btn" class="btn btn-secondary-sm">Cancel</button>
          <button id="bookmark-save-btn" class="btn btn-primary">Save Bookmark</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('bookmark-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('bookmark-save-btn').addEventListener('click', () => {
      const label = document.getElementById('bookmark-label-input').value.trim() || `Page ${this.state.currentPage}`;
      const folder = document.getElementById('bookmark-folder-input').value.trim() || 'General';

      Storage.saveBookmark({
        id: Storage.generateId(),
        pdfId: this.state.pdfId,
        pdfName: this.state.pdfName,
        page: this.state.currentPage,
        label,
        folder,
        createdAt: Date.now(),
      });
      overlay.remove();
    });
  },

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.state.totalPages) return;
    this.state.currentPage = pageNum;
    document.getElementById('page-input').value = pageNum;
    this.renderPage(pageNum);
  },
};