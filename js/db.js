const DB = {
  async init() {
    return true;
  },

  async savePDF({ id, name, file, totalPages = null }) {
    const form = new FormData();
    form.append('id', id);
    form.append('name', name);
    if (totalPages !== null) form.append('totalPages', totalPages);
    form.append('file', file, name);

    const data = await Auth.request('/api/pdfs', {
      method: 'POST',
      body: form,
    });
    return { ...data, file };
  },

  async getPDF(id) {
    const response = await fetch(`/api/pdfs/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return {
      id,
      name: response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'document.pdf',
      file: blob,
    };
  },

  async getAllPDFs() {
    const data = await Auth.request('/api/pdfs');
    return data.pdfs || [];
  },

  async deletePDF(id) {
    await Auth.request(`/api/pdfs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  },

  async deleteAllPDFs() {
    await Auth.request('/api/pdfs', { method: 'DELETE' });
    return true;
  },
};
