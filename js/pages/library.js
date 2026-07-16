window.Pages.Library = {
  // Formats a Date/timestamp into something readable, e.g. "Jul 15, 2026"
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },

  render() {
    // Initial render shows a loading state — the real PDF list loads async in afterRender()
    return `
      <div class="page-header">
        <h1>Library</h1>
        <p class="page-subtitle">Your uploaded PDFs</p>
      </div>

      <div id="drop-zone" class="drop-zone">
        <input type="file" id="file-input" accept="application/pdf" hidden />
        <span class="drop-icon">📄</span>
        <p class="drop-text">Drag & drop a PDF here, or</p>
        <button id="browse-btn" class="btn btn-primary">Browse Files</button>
      </div>

      <div id="upload-status"></div>

      <div id="library-grid" class="library-grid">
        <p class="placeholder-content">Loading your PDFs...</p>
      </div>
    `;
  },

  async afterRender() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const statusEl = document.getElementById('upload-status');

    // --- Browse button opens the native file picker ---
    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0], statusEl);
      }
    });

    // --- Drag & drop handlers ---
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault(); // required to allow dropping
      dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone-active');

      if (e.dataTransfer.files.length > 0) {
        this.handleFile(e.dataTransfer.files[0], statusEl);
      }
    });

    // --- Load and render the existing PDF grid ---
    await this.renderGrid();
  },

  async handleFile(file, statusEl) {
    // Validate it's actually a PDF before touching IndexedDB
    if (file.type !== 'application/pdf') {
      statusEl.innerHTML = `<p class="status-error">Only PDF files are supported.</p>`;
      return;
    }

    statusEl.innerHTML = `<p class="status-info">Uploading "${file.name}"...</p>`;

    try {
      const record = await DB.savePDF({
        id: Storage.generateId(),
        name: file.name,
        file: file, // stored directly as a Blob/File — IndexedDB supports this natively
      });

      statusEl.innerHTML = `<p class="status-success">"${record.name}" uploaded successfully.</p>`;

      // Refresh the grid to show the newly added PDF
      await this.renderGrid();

      // Clear the status message after a couple seconds
      setTimeout(() => { statusEl.innerHTML = ''; }, 2500);
    } catch (error) {
      console.error('PDF upload failed:', error);
      statusEl.innerHTML = `<p class="status-error">Upload failed. Please try again.</p>`;
    }
  },

  async renderGrid() {
    const grid = document.getElementById('library-grid');
    const pdfs = await DB.getAllPDFs();

    if (pdfs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📚</span>
          <p>No PDFs yet. Upload one above to get started.</p>
        </div>
      `;
      return;
    }

    // Most recently uploaded first
    pdfs.sort((a, b) => b.uploadedAt - a.uploadedAt);

    grid.innerHTML = pdfs
      .map(
        (pdf) => `
        <div class="pdf-card" data-id="${pdf.id}">
          <div class="pdf-card-icon">📄</div>
          <div class="pdf-card-info">
            <p class="pdf-card-name" title="${pdf.name}">${pdf.name}</p>
            <p class="pdf-card-date">Uploaded ${this.formatDate(pdf.uploadedAt)}</p>
          </div>
          <button class="pdf-card-delete" data-id="${pdf.id}" title="Delete">🗑️</button>
        </div>
      `
      )
      .join('');

    // Attach click handlers after injecting HTML (innerHTML wipes old listeners)
    grid.querySelectorAll('.pdf-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // Don't trigger "open" if the delete button inside the card was clicked
        if (e.target.classList.contains('pdf-card-delete')) return;

        const id = card.getAttribute('data-id');
        Router.navigate(`/reader?id=${id}`);
      });
    });

    grid.querySelectorAll('.pdf-card-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // prevent the card's own click handler from firing too
        const id = btn.getAttribute('data-id');

        const confirmed = confirm('Delete this PDF? This cannot be undone.');
        if (!confirmed) return;

        await DB.deletePDF(id);
        await this.renderGrid(); // refresh the grid after deletion
      });
    });
  },
};