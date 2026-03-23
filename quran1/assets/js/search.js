/**
 * Quran Studio — Search Module v2
 */

class QuranSearch {
  constructor() {
    this.overlay = null;
    this.input = null;
    this.results = null;
    this.searchTimeout = null;
    this.surahList = [];
  }

  _init() {
    this.overlay = $('#searchOverlay');
    this.input = $('#globalSearch');
    this.results = $('#searchResults');

    $('#searchToggle')?.addEventListener('click', () => this.toggle());
    $('#closeSearch')?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    this.input?.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) { this.results.innerHTML = ''; return; }
      this.searchTimeout = setTimeout(() => this._doSearch(q), 250);
    });

    this.results?.addEventListener('keydown', (e) => {
      const items = this._getItems();
      const activeIdx = items.findIndex(el => el.classList.contains('active'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._setActive(Math.min(activeIdx + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._setActive(Math.max(activeIdx - 1, 0));
      } else if (e.key === 'Enter') {
        const active = items[activeIdx];
        if (active) active.click();
      }
    });
  }

  open() {
    if (!this.overlay) return;
    this.overlay.classList.add('active');
    this.overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.input?.focus(), 50);
    if (!this.surahList.length) this._loadSurahList();
  }

  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('active');
    this.overlay.setAttribute('aria-hidden', 'true');
    if (this.input) this.input.value = '';
    if (this.results) this.results.innerHTML = '';
  }

  toggle() {
    this.isOpen() ? this.close() : this.open();
  }

  isOpen() {
    return this.overlay?.classList.contains('active') || false;
  }

  async _loadSurahList() {
    try {
      this.surahList = await window.QuranAPI.fetchSurahList();
    } catch {
      this.surahList = window.QuranAPI.getOfflineSurahList();
    }
  }

  async _doSearch(query) {
    this.results.innerHTML = '<div style="display:flex;justify-content:center;padding:24px"><div class="spinner"></div></div>';

    const localResults = this._localSearch(query);

    const apiResults = await window.QuranAPI.searchQuran(query);

    const seen = new Set();
    const combined = [];
    for (const r of [...localResults, ...apiResults]) {
      const key = `${r.type}-${r.surah}-${r.ayah}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(r);
      }
    }

    this._render(combined, query);
  }

  _localSearch(query) {
    const q = query.toLowerCase();
    return this.surahList
      .filter(s =>
        (s.englishName || '').toLowerCase().includes(q) ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.englishNameTranslation || '').toLowerCase().includes(q) ||
        String(s.number).includes(q)
      )
      .slice(0, 10)
      .map(s => ({
        type: 'surah',
        surah: s.number,
        surahName: s.englishName || s.name || '',
        surahArabic: s.name || '',
        ayah: null,
        text: null,
        translation: `${s.revelationType || ''} · ${s.numberOfAyahs} Ayahs`,
      }));
  }

  _render(results, query) {
    if (!results.length) {
      this.results.innerHTML = `<div style="padding:32px 16px;text-align:center;color:var(--text-muted);font-size:.9rem">No results for "<strong>${this._esc(query)}</strong>"</div>`;
      return;
    }

    this.results.innerHTML = '';
    results.slice(0, 25).forEach(r => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.type = r.type;
      item.dataset.surah = r.surah;
      if (r.ayah) item.dataset.ayah = r.ayah;

      item.innerHTML = `
        <span class="result-number">${r.type === 'surah' ? r.surah : r.ayah}</span>
        <div class="result-arabic">${r.surahArabic || ''}</div>
        <div class="result-info">
          <div class="result-name">${this._esc(r.surahName || (r.type === 'ayah' ? `Surah ${r.surah}` : ''))}</div>
          <div class="result-meta">${this._esc(r.translation || (r.text ? r.text.substring(0, 80) : ''))}${r.type === 'ayah' ? ` — Ayah ${r.ayah}` : ''}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.close();
        if (r.type === 'surah') {
          window.location.hash = `/surah/${r.surah}`;
        } else {
          window.location.hash = `/surah/${r.surah}#ayah-${r.ayah}`;
        }
      });
      item.addEventListener('mouseenter', () => {
        this._getItems().forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      this.results.appendChild(item);
    });
  }

  _getItems() {
    return Array.from(this.results?.querySelectorAll('.search-result-item') || []);
  }

  _setActive(idx) {
    const items = this._getItems();
    items.forEach((el, i) => el.classList.toggle('active', i === idx));
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  _esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

window.QuranSearch = new QuranSearch();
window.QuranSearch._init();
