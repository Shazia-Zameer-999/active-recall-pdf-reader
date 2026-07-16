window.Pages.Notes = {
  state: {
    editingId: null, // id of note currently being edited, or null for "creating new"
    searchQuery: '',
    activeTag: null,
  },

  render() {
    return `
      <div class="page-header">
        <h1>Notes</h1>
        <p class="page-subtitle">Capture what matters as you read</p>
      </div>

      <div class="notes-toolbar">
        <input type="text" id="notes-search" class="notes-search-input" placeholder="Search notes..." />
        <button id="new-note-btn" class="btn btn-primary">+ New Note</button>
      </div>

      <div id="notes-tag-filter" class="notes-tag-filter"></div>

      <div id="note-form-container"></div>

      <div id="notes-list-container"></div>
    `;
  },

  afterRender() {
    document.getElementById('new-note-btn').addEventListener('click', () => this.showForm());

    document.getElementById('notes-search').addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.toLowerCase();
      this.renderList();
    });

    this.renderTagFilter();
    this.renderList();
  },

  getAllTags() {
    const notes = Storage.getNotes();
    const tagSet = new Set();
    notes.forEach((note) => (note.tags || []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet);
  },

  renderTagFilter() {
    const tags = this.getAllTags();
    const container = document.getElementById('notes-tag-filter');

    if (tags.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = tags
      .map(
        (tag) => `
        <button class="tag-chip ${this.state.activeTag === tag ? 'tag-chip-active' : ''}" data-tag="${tag}">
          ${tag}
        </button>
      `
      )
      .join('');

    container.querySelectorAll('.tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const tag = chip.getAttribute('data-tag');
        this.state.activeTag = this.state.activeTag === tag ? null : tag;
        this.renderTagFilter();
        this.renderList();
      });
    });
  },

  showForm(note = null) {
    this.state.editingId = note ? note.id : null;
    const container = document.getElementById('note-form-container');

    container.innerHTML = `
      <div class="note-form">
        <input type="text" id="note-title-input" class="manual-form-input" placeholder="Note title" value="${note ? note.title : ''}" />
        <textarea id="note-content-input" class="manual-form-input" placeholder="Write your note..." rows="4">${note ? note.content : ''}</textarea>
        <input type="text" id="note-tags-input" class="manual-form-input" placeholder="Tags (comma-separated)" value="${note && note.tags ? note.tags.join(', ') : ''}" />
        <input type="number" id="note-page-input" class="settings-number-input" placeholder="Page #" min="1" value="${note && note.pageNumber ? note.pageNumber : ''}" style="width: 100px;" />
        <div class="manual-form-actions">
          <button id="note-cancel-btn" class="btn btn-secondary-sm">Cancel</button>
          <button id="note-save-btn" class="btn btn-primary">${note ? 'Update Note' : 'Save Note'}</button>
        </div>
      </div>
    `;

    document.getElementById('note-cancel-btn').addEventListener('click', () => {
      container.innerHTML = '';
      this.state.editingId = null;
    });

    document.getElementById('note-save-btn').addEventListener('click', () => this.saveNote(note));
  },

  saveNote(existingNote) {
    const title = document.getElementById('note-title-input').value.trim();
    const content = document.getElementById('note-content-input').value.trim();
    const tagsRaw = document.getElementById('note-tags-input').value.trim();
    const pageNumber = document.getElementById('note-page-input').value;

    if (!title || !content) return;

    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

    const note = existingNote
      ? { ...existingNote, title, content, tags, pageNumber: pageNumber ? parseInt(pageNumber, 10) : null }
      : {
          id: Storage.generateId(),
          title,
          content,
          tags,
          pageNumber: pageNumber ? parseInt(pageNumber, 10) : null,
          pdfId: null,
          pinned: false,
          createdAt: Date.now(),
        };

    Storage.saveNote(note);

    document.getElementById('note-form-container').innerHTML = '';
    this.state.editingId = null;
    this.renderTagFilter();
    this.renderList();
  },

  renderList() {
    const container = document.getElementById('notes-list-container');
    let notes = Storage.getNotes();

    if (this.state.searchQuery) {
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(this.state.searchQuery) ||
          n.content.toLowerCase().includes(this.state.searchQuery)
      );
    }

    if (this.state.activeTag) {
      notes = notes.filter((n) => (n.tags || []).includes(this.state.activeTag));
    }

    // Pinned first, then newest first
    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <p>No notes found. Create one to get started.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="notes-grid">
        ${notes
          .map(
            (note) => `
          <div class="note-card">
            <div class="note-card-header">
              <button class="note-pin-btn ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" title="Pin note">📌</button>
              <h4 class="note-card-title">${note.title}</h4>
            </div>
            <p class="note-card-content">${note.content}</p>
            ${note.pageNumber ? `<p class="note-card-page">Page ${note.pageNumber}</p>` : ''}
            ${
              note.tags && note.tags.length > 0
                ? `<div class="note-card-tags">${note.tags.map((t) => `<span class="tag-chip-small">${t}</span>`).join('')}</div>`
                : ''
            }
            <div class="note-card-actions">
              <button class="note-edit-btn" data-id="${note.id}">Edit</button>
              <button class="note-delete-btn" data-id="${note.id}">Delete</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    container.querySelectorAll('.note-pin-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const note = Storage.getNotes().find((n) => n.id === id);
        note.pinned = !note.pinned;
        Storage.saveNote(note);
        this.renderList();
      });
    });

    container.querySelectorAll('.note-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const note = Storage.getNotes().find((n) => n.id === id);
        this.showForm(note);
      });
    });

    container.querySelectorAll('.note-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this note?')) {
          Storage.deleteNote(id);
          this.renderTagFilter();
          this.renderList();
        }
      });
    });
  },
};