window.Pages.Library = {
  state: { query: '' },

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

      <div class="library-toolbar">
        <input id="library-search" class="notes-search-input" type="search" placeholder="Search your PDFs..." aria-label="Search your PDFs" />
        <div class="library-view-toggle">
        <button id="view-pdfs-btn" class="btn btn-secondary-sm active-view">📚 My PDFs</button>
        <button id="view-bookmarks-btn" class="btn btn-secondary-sm">📑 Bookmarks</button>
        </div>
      </div>

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

 document.getElementById('view-pdfs-btn').addEventListener('click', () => {
      document.getElementById('view-pdfs-btn').classList.add('active-view');
      document.getElementById('view-bookmarks-btn').classList.remove('active-view');
      this.renderGrid();
    });

    document.getElementById('view-bookmarks-btn').addEventListener('click', () => {
      document.getElementById('view-bookmarks-btn').classList.add('active-view');
      document.getElementById('view-pdfs-btn').classList.remove('active-view');
      this.renderBookmarksView();
    });

    document.getElementById('library-search').addEventListener('input', (event) => {
      this.state.query = event.target.value.trim().toLowerCase();
      this.renderGrid();
    });

    // --- Load and render the existing PDF grid ---
    await this.renderGrid();
  },

  renderBookmarksView() {
    const grid = document.getElementById('library-grid');
    const bookmarks = Storage.getBookmarks();

    if (bookmarks.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📑</span>
          <p>No bookmarks yet. Open a PDF in the Reader and click "Bookmark" to add one.</p>
        </div>
      `;
      return;
    }

    // Group by folder
    const grouped = {};
    bookmarks.forEach((b) => {
      const folder = b.folder || 'General';
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(b);
    });

    grid.innerHTML = `
      <div class="bookmarks-list">
        ${Object.keys(grouped)
          .map(
            (folder) => `
          <div class="bookmark-folder">
            <h4 class="bookmark-folder-title">📁 ${folder}</h4>
            <div class="bookmark-items">
              ${grouped[folder]
                .map(
                  (b) => `
                <div class="bookmark-item" data-pdf-id="${b.pdfId}" data-page="${b.page}">
                  <span class="bookmark-color-dot" style="background:${b.color}"></span>
                  <div class="bookmark-item-info">
                    <p class="bookmark-item-label">${b.label}</p>
                    <p class="bookmark-item-meta">${b.pdfName} — Page ${b.page}</p>
                  </div>
                  <button class="bookmark-delete-btn" data-id="${b.id}">🗑️</button>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    grid.querySelectorAll('.bookmark-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-delete-btn')) return;
        const pdfId = item.getAttribute('data-pdf-id');
        const page = item.getAttribute('data-page');
        Router.navigate(`/reader?id=${pdfId}&page=${page}`);
      });
    });

    grid.querySelectorAll('.bookmark-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        Storage.deleteBookmark(id);
        this.renderBookmarksView();
      });
    });
  },

  async handleFile(file, statusEl) {
    // Validate it's actually a PDF before touching IndexedDB
    if (file.type !== 'application/pdf') {
      statusEl.innerHTML = `<p class="status-error">Only PDF files are supported.</p>`;
      return;
    }

    const MAX_PDF_BYTES = 25 * 1024 * 1024; // matches MAX_CONTENT_LENGTH in app.py
    if (file.size > MAX_PDF_BYTES) {
      statusEl.innerHTML = `<p class="status-error">"${file.name}" is too large. PDFs must be 25 MB or smaller.</p>`;
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
      const message = error.status === 413
        ? `"${file.name}" is too large. PDFs must be 25 MB or smaller.`
        : 'Upload failed. Please try again.';
      statusEl.innerHTML = `<p class="status-error">${message}</p>`;
    }
  },

  async renderGrid() {
    const grid = document.getElementById('library-grid');
    const pdfs = await DB.getAllPDFs();
    const filteredPdfs = pdfs.filter((pdf) => pdf.name.toLowerCase().includes(this.state.query));

    if (pdfs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📚</span>
          <p>No PDFs yet. Upload one above to get started.</p>
        </div>
      `;
      return;
    }

    if (filteredPdfs.length === 0) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><p>No PDFs match “${this.escapeHtml(this.state.query)}”.</p></div>`;
      return;
    }

    // Most recently uploaded first
    filteredPdfs.sort((a, b) => b.uploadedAt - a.uploadedAt);

    grid.innerHTML = filteredPdfs
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

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  },
};
