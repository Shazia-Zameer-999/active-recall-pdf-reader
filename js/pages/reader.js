// js/pages/reader.js — RecalIo Active Recall Reader with Aa Typography & Designer Reflow

window.Pages.Reader = {
  state: {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.2,
    fitWidth: true,
    pdfId: null,
    pdfName: '',
    viewMode: 'original', // 'original' | 'reflow'
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 1.7,
    readerTheme: 'light', // light | sepia | dark | oled
    currentPageText: '',
    renderToken: 0,
    pageVisitId: 0,
    currentRenderTask: null,
  },

  render() {
    document.body.classList.remove('reader-fullscreen');

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
          <button id="full-view-btn" class="btn btn-secondary-sm" title="Open reader in full view" aria-pressed="false">⛶ Full View</button>
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
      canvasContainer.innerHTML = `<div class="empty-state"><p>No PDF selected. <a href="#/library">Choose a PDF from your library</a>.</p></div>`;
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
      await loadPdfJs();
    } catch (error) {
      console.error('Failed to load PDF engine:', error);
      canvasContainer.innerHTML = `<div class="empty-state"><p>Couldn't load the PDF engine. Check your connection and try again.</p></div>`;
      return;
    }

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
        const history = Storage.getReadingHistory().find((h) => h.pdfId === id);
        if (history && history.currentPage && history.currentPage <= this.state.totalPages) {
          targetPage = history.currentPage;
        }
      }
      this.state.currentPage = targetPage;
      this.state.pageVisitId = 1;

      document.getElementById('total-pages').textContent = this.state.totalPages;
      document.getElementById('page-input').max = this.state.totalPages;
      document.getElementById('page-input').value = targetPage;

      this.attachToolbarListeners();
      this.attachAnnotationToolbarListeners();
      this.attachAaMenuListeners();
      this.attachViewModeListeners();
      this.attachTouchNavigation();
      this.attachFullViewListener();

      const groupId = Router.getQueryParam('groupId') || localStorage.getItem('impactx_active_group_id');
      if (groupId && typeof Realtime !== 'undefined') Realtime.joinGroup(groupId);
      try {
        if (typeof StudySessions !== 'undefined') await StudySessions.start(this.state.pdfId, this.state.currentPage);
        if (typeof Realtime !== 'undefined') Realtime.studyStarted(this.state.pdfId, this.state.currentPage, this.state.pdfName);
      } catch (error) {
        console.error('Study session start failed:', error);
      }

      await this.fitToWidth();
    } catch (error) {
      console.error('Failed to render document:', error);
      canvasContainer.innerHTML = `<div class="empty-state"><p>Couldn't load this PDF. It may be corrupted.</p></div>`;
    }

    let resizeTimer = null;
    this.state.handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (this.state.fitWidth) this.fitToWidth();
      }, 150);
    };
    window.addEventListener('resize', this.state.handleResize);
  },

  destroy() {
    if (this.state.exitFullView) {
      this.state.exitFullView();
      this.state.exitFullView = null;
    }
    if (this.state.handleResize) {
      window.removeEventListener('resize', this.state.handleResize);
      this.state.handleResize = null;
    }
  },

  async fitToWidth() {
    if (!this.state.pdfDoc) return;
    if (this.state.viewMode === 'reflow') {
      await this.renderPage(this.state.currentPage);
      return;
    }
    const page = await this.state.pdfDoc.getPage(this.state.currentPage);
    const container = document.getElementById('reader-canvas-container');
    if (!container) return;
    const containerWidth = Math.max(1, container.clientWidth - 24);
    const unscaledViewport = page.getViewport({ scale: 1 });
    this.state.scale = containerWidth / unscaledViewport.width;
    this.state.fitWidth = true;
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(this.state.scale * 100)}%`;
    await this.renderPage(this.state.currentPage);
  },

  async renderPage(pageNumber, visitId = this.state.pageVisitId) {
    const renderToken = ++this.state.renderToken;

    if (this.state.currentRenderTask) {
      try {
        this.state.currentRenderTask.cancel();
      } catch (error) {
        // Safe to ignore
      }
      this.state.currentRenderTask = null;
    }

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

      if (renderToken !== this.state.renderToken) return;
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

      const renderTask = page.render({ canvasContext: context, viewport, transform });
      this.state.currentRenderTask = renderTask;

      try {
        await renderTask.promise;
      } catch (error) {
        if (error && error.name === 'RenderingCancelledException') return;
        console.error('Failed to render page', pageNumber, error);
        if (renderToken === this.state.renderToken) {
          canvasContainer.innerHTML = `<div class="empty-state"><p>Couldn't render this page. Try again.</p></div>`;
        }
        return;
      } finally {
        if (this.state.currentRenderTask === renderTask) this.state.currentRenderTask = null;
      }
      if (renderToken !== this.state.renderToken) return;

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
    if (pageText.trim().length >= 30) {
      ActiveRecall.onPageRead(pageText, pageNumber, visitId);
    } else {
      const cached = Storage.getCachedOcrText(this.state.pdfId, pageNumber);
      if (cached) {
        ActiveRecall.onPageRead(cached, pageNumber, visitId);
      } else {
        const canvas = document.getElementById('pdf-canvas');
        if (canvas) this.runBackgroundOcr(canvas, pageNumber, visitId, renderToken);
      }
    }
  },

  async runBackgroundOcr(canvas, pageNumber, visitId, renderToken) {
    this.showOcrIndicator(true);
    try {
      const pageText = await OCR.recognizeCanvas(canvas);
      Storage.setCachedOcrText(this.state.pdfId, pageNumber, pageText);
      if (renderToken !== this.state.renderToken) return;
      this.state.currentPageText = pageText;
      ActiveRecall.onPageRead(pageText, pageNumber, visitId);
    } catch (error) {
      console.error('OCR failed for page', pageNumber, error);
    } finally {
      this.showOcrIndicator(false);
    }
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
      this.state.fitWidth = false;
      zoomLevelEl.textContent = `${Math.round(this.state.scale * 100)}%`;
      this.renderPage(this.state.currentPage);
    });

    zoomOutBtn.addEventListener('click', () => {
      this.state.scale = Math.max(this.state.scale - 0.2, 0.4);
      this.state.fitWidth = false;
      zoomLevelEl.textContent = `${Math.round(this.state.scale * 100)}%`;
      this.renderPage(this.state.currentPage);
    });

    fitWidthBtn.addEventListener('click', () => this.fitToWidth());
    document.getElementById('bookmark-page-btn').addEventListener('click', () => this.showBookmarkPopup());
  },

  attachTouchNavigation() {
    const container = document.getElementById('reader-canvas-container');
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    container.addEventListener('touchstart', (event) => {
      if (Annotations.state.tool !== 'none' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    }, { passive: true });

    container.addEventListener('touchend', (event) => {
      if (Annotations.state.tool !== 'none' || !startTime || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const elapsed = Date.now() - startTime;
      startTime = 0;

      if (elapsed > 650 || Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
      this.goToPage(this.state.currentPage + (deltaX < 0 ? 1 : -1));
    }, { passive: true });
  },

  attachFullViewListener() {
    const button = document.getElementById('full-view-btn');
    if (!button) return;

    const updateButton = () => {
      const isFullView = document.body.classList.contains('reader-fullscreen')
        || Boolean(document.fullscreenElement)
        || Boolean(document.webkitFullscreenElement);
      button.textContent = isFullView ? '⛶ Exit Full View' : '⛶ Full View';
      button.title = isFullView ? 'Exit full view' : 'Open reader in full view';
      button.setAttribute('aria-pressed', String(isFullView));
    };

    const toggle = async () => {
      const readerPage = document.querySelector('.reader-page');
      const isFullView = document.body.classList.contains('reader-fullscreen')
        || Boolean(document.fullscreenElement)
        || Boolean(document.webkitFullscreenElement);

      if (isFullView) {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        document.body.classList.remove('reader-fullscreen');
      } else {
        document.body.classList.add('reader-fullscreen');
        const requestFullscreen = readerPage?.requestFullscreen || readerPage?.webkitRequestFullscreen;
        if (requestFullscreen) {
          try {
            await requestFullscreen.call(readerPage);
          } catch (error) {
            console.warn('Native fullscreen unavailable; using reader full view.', error);
          }
        }
      }

      updateButton();
      if (this.state.fitWidth) requestAnimationFrame(() => this.fitToWidth());
    };

    button.addEventListener('click', toggle);
    this.state.exitFullView = () => {
      if (!document.body.classList.contains('reader-fullscreen')
        && !document.fullscreenElement
        && !document.webkitFullscreenElement) return;
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
      document.body.classList.remove('reader-fullscreen');
      updateButton();
      if (this.state.fitWidth) requestAnimationFrame(() => this.fitToWidth());
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        document.body.classList.remove('reader-fullscreen');
      }
      updateButton();
      if (this.state.fitWidth) requestAnimationFrame(() => this.fitToWidth());
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.state.exitFullView();
    }, { once: false });
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
    if (pageNum === this.state.currentPage) return;
    this.state.currentPage = pageNum;
    this.state.pageVisitId += 1;
    if (typeof StudySessions !== 'undefined') {
      StudySessions.update(pageNum).catch((error) => console.error('Study session update failed:', error));
    }
    if (typeof Realtime !== 'undefined') {
      Realtime.studyUpdated(pageNum);
    }
    const pageInput = document.getElementById('page-input');
    if (pageInput) pageInput.value = pageNum;
    this.renderPage(pageNum);
  },
};