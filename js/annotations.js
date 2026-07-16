const Annotations = {
  state: {
    pdfId: null,
    pageNumber: null,
    scale: 1,
    tool: 'none',
    color: '#ffeb3b',
    isDrawing: false,
    currentStroke: [],
  },

  init(pdfId, pageNumber, scale) {
    this.state.pdfId = pdfId;
    this.state.pageNumber = pageNumber;
    this.state.scale = scale;
  },

  setTool(tool) {
    this.state.tool = tool;
    this.updateLayerInteractivity();
  },

  setColor(color) {
    this.state.color = color;
  },

  updateLayerInteractivity() {
    const textLayer = document.getElementById('text-layer');
    const overlayCanvas = document.getElementById('annotation-canvas');
    const stickyLayer = document.getElementById('sticky-layer');

    if (!textLayer || !overlayCanvas || !stickyLayer) return;

    const tool = this.state.tool;

    textLayer.style.pointerEvents = tool === 'highlight' || tool === 'underline' ? 'auto' : 'none';
    overlayCanvas.style.pointerEvents = tool === 'draw' ? 'auto' : 'none';
    stickyLayer.style.pointerEvents = tool === 'sticky' ? 'auto' : 'none';
  },

  async renderTextLayer(page, viewport) {
    const textLayerDiv = document.getElementById('text-layer');
    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    textLayerDiv.style.setProperty('--scale-factor', this.state.scale);

    const textContent = await page.getTextContent();

    try {
      const task = pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await task.promise;
    } catch (error) {
      console.error('Text layer render failed:', error);
    }

    textLayerDiv.addEventListener('mouseup', () => this.handleTextSelection());
  },

  handleTextSelection() {
    if (this.state.tool !== 'highlight' && this.state.tool !== 'underline') return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) return;

    const range = selection.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());
    const container = document.getElementById('pdf-page-wrapper');
    const containerRect = container.getBoundingClientRect();
    const scale = this.state.scale;

    const rects = clientRects.map((r) => ({
      x: (r.left - containerRect.left) / scale,
      y: (r.top - containerRect.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }));

    const annotation = {
      id: Storage.generateId(),
      type: this.state.tool,
      color: this.state.color,
      rects,
      text: selection.toString(),
      createdAt: Date.now(),
    };

    Storage.addAnnotation(this.state.pdfId, this.state.pageNumber, annotation);
    selection.removeAllRanges();
    this.renderOverlay();
  },

  attachDrawListeners() {
    const canvas = document.getElementById('annotation-canvas');

    canvas.onpointerdown = (e) => {
      if (this.state.tool !== 'draw') return;
      this.state.isDrawing = true;
      const point = this.getCanvasPoint(e, canvas);
      this.state.currentStroke = [point];
    };

    canvas.onpointermove = (e) => {
      if (!this.state.isDrawing) return;
      const point = this.getCanvasPoint(e, canvas);
      this.state.currentStroke.push(point);
      this.renderOverlay();
    };

    canvas.onpointerup = () => {
      if (!this.state.isDrawing) return;
      this.state.isDrawing = false;

      if (this.state.currentStroke.length > 1) {
        const annotation = {
          id: Storage.generateId(),
          type: 'draw',
          color: this.state.color,
          points: this.state.currentStroke,
          createdAt: Date.now(),
        };
        Storage.addAnnotation(this.state.pdfId, this.state.pageNumber, annotation);
      }

      this.state.currentStroke = [];
      this.renderOverlay();
    };
  },

  getCanvasPoint(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scale = this.state.scale;
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  },

  attachStickyListener() {
    const stickyLayer = document.getElementById('sticky-layer');

    stickyLayer.onclick = (e) => {
      if (this.state.tool !== 'sticky') return;
      if (e.target !== stickyLayer) return;

      const rect = stickyLayer.getBoundingClientRect();
      const scale = this.state.scale;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const text = prompt('Enter your note:');
      if (!text || !text.trim()) return;

      const annotation = {
        id: Storage.generateId(),
        type: 'sticky',
        x,
        y,
        text: text.trim(),
        createdAt: Date.now(),
      };

      Storage.addAnnotation(this.state.pdfId, this.state.pageNumber, annotation);
      this.renderStickyLayer();
    };
  },

  renderOverlay() {
    const canvas = document.getElementById('annotation-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = this.state.scale;
    const annotations = Storage.getPageAnnotations(this.state.pdfId, this.state.pageNumber);

    annotations.forEach((a) => {
      if (a.type === 'highlight') {
        ctx.fillStyle = a.color;
        ctx.globalAlpha = 0.4;
        a.rects.forEach((r) => {
          ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
        });
        ctx.globalAlpha = 1;
      }

      if (a.type === 'underline') {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2;
        a.rects.forEach((r) => {
          const y = (r.y + r.height) * scale;
          ctx.beginPath();
          ctx.moveTo(r.x * scale, y);
          ctx.lineTo((r.x + r.width) * scale, y);
          ctx.stroke();
        });
      }

      if (a.type === 'draw') {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        a.points.forEach((p, i) => {
          const x = p.x * scale;
          const y = p.y * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    });

    if (this.state.isDrawing && this.state.currentStroke.length > 1) {
      ctx.strokeStyle = this.state.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      this.state.currentStroke.forEach((p, i) => {
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  },

  renderStickyLayer() {
    const stickyLayer = document.getElementById('sticky-layer');
    if (!stickyLayer) return;

    const scale = this.state.scale;
    const annotations = Storage.getPageAnnotations(this.state.pdfId, this.state.pageNumber);
    const stickies = annotations.filter((a) => a.type === 'sticky');

    stickyLayer.innerHTML = stickies
      .map(
        (s) => `
        <button class="sticky-pin" data-id="${s.id}" style="left: ${s.x * scale}px; top: ${s.y * scale}px;" title="${s.text.replace(/"/g, '&quot;')}">
          📌
        </button>
      `
      )
      .join('');

    stickyLayer.querySelectorAll('.sticky-pin').forEach((pin) => {
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = pin.getAttribute('data-id');
        const note = stickies.find((s) => s.id === id);
        const remove = confirm(`Note: "${note.text}"\n\nClick OK to delete this note, Cancel to keep it.`);
        if (remove) {
          Storage.deleteAnnotation(this.state.pdfId, this.state.pageNumber, id);
          this.renderStickyLayer();
        }
      });
    });
  },

  renderPanel() {
    const panel = document.getElementById('annotations-panel-list');
    if (!panel) return;

    const annotations = Storage.getPageAnnotations(this.state.pdfId, this.state.pageNumber);

    if (annotations.length === 0) {
      panel.innerHTML = `<p class="annotations-empty">No annotations on this page yet.</p>`;
      return;
    }

    panel.innerHTML = annotations
      .map((a) => {
        let label = '';
        if (a.type === 'highlight') label = `Highlight: "${a.text.slice(0, 60)}"`;
        if (a.type === 'underline') label = `Underline: "${a.text.slice(0, 60)}"`;
        if (a.type === 'draw') label = `Drawing`;
        if (a.type === 'sticky') label = `Note: "${a.text.slice(0, 60)}"`;

        return `
          <div class="annotation-panel-item">
            <span class="annotation-swatch" style="background: ${a.color || '#888'}"></span>
            <span class="annotation-panel-label">${label}</span>
            <button class="annotation-panel-delete" data-id="${a.id}">🗑️</button>
          </div>
        `;
      })
      .join('');
  },

  renderAll() {
    this.renderOverlay();
    this.renderStickyLayer();
    this.renderPanel();
    this.attachPanelDeleteListener();
  },

  attachPanelDeleteListener() {
    const panel = document.getElementById('annotations-panel-list');
    if (!panel || panel.dataset.listenerAttached) return;

    panel.dataset.listenerAttached = 'true';

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('.annotation-panel-delete');
      if (!btn) return;

      const id = btn.getAttribute('data-id');
      Storage.deleteAnnotation(this.state.pdfId, this.state.pageNumber, id);
      this.renderOverlay();
      this.renderStickyLayer();
      this.renderPanel();
    });
  },

  exportAnnotations(pdfId, pdfName) {
    const all = Storage.getAllAnnotationsForPdf(pdfId);
    if (all.length === 0) {
      alert('No annotations to export for this PDF.');
      return;
    }

    let output = `Annotations for: ${pdfName}\n${'='.repeat(40)}\n\n`;
    all.forEach((a) => {
      output += `Page ${a.pageNumber} — ${a.type.toUpperCase()}\n`;
      if (a.text) output += `"${a.text}"\n`;
      output += '\n';
    });

    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pdfName.replace('.pdf', '')}_annotations.txt`;
    link.click();
    URL.revokeObjectURL(url);
  },
};