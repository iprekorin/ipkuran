/**
 * Quran Studio — Main Application v2
 */

class QuranApp {
  constructor() {
    this.surahList = [];
    this.currentSurah = null;
    this.currentAyahIndex = 0;
    this.surahCache = {};
  }

  async init() {
    // Apply saved preferences
    const theme = window.QuranStorage?.loadTheme() || 'dark';
    this._applyTheme(theme);

    const lang = window.QuranStorage?.loadLang() || 'en';
    window.QuranAPI.setCurrentLang(lang);
    const langSel = $('#langSelector');
    if (langSel) langSel.value = lang;

    const reciter = window.QuranStorage?.loadReciter() || 'ar.alafasy';
    const reciterSel = $('#reciterSelect');
    if (reciterSel) reciterSel.value = reciter;
    window.QuranAudio?.setReciter(reciter);

    const showTrans = window.QuranStorage?.loadShowTranslation() ?? true;
    const showTaf = window.QuranStorage?.loadShowTafsir() ?? false;
    const showTransEl = $('#showTranslation');
    if (showTransEl) showTransEl.checked = showTrans;
    const showTafEl = $('#showTafsir');
    if (showTafEl) showTafEl.checked = showTaf;

    // Setup all UI events
    this._setupUI();

    // Load Surah list
    try {
      this.surahList = await window.QuranAPI.fetchSurahList();
      window.QuranUI.renderSurahList(this.surahList);
    } catch (e) {
      this.surahList = window.QuranAPI.getOfflineSurahList();
      window.QuranUI.renderSurahList(this.surahList);
    }

    // Render static pages
    window.QuranUI.renderJuzzGrid();

    // Router
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();

    // Daily Ayah
    this._loadDailyAyah();

    // Hide loading
    window.QuranUI.showLoading(false);

    // PWA install prompt
    this._setupPWA();
  }

  _setupUI() {
    // Theme toggle
    $('#themeToggle')?.addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      this._applyTheme(next);
      window.QuranStorage?.saveTheme(next);
    });

    // Language change — reload Surah with new language
    $('#langSelector')?.addEventListener('change', async (e) => {
      const lang = e.target.value;
      window.QuranAPI.setCurrentLang(lang);
      window.QuranStorage?.saveLang(lang);
      // Invalidate cache and reload
      if (this.currentSurah) {
        delete this.surahCache[this.currentSurah];
        await this._loadSurah(this.currentSurah, this.currentAyahIndex);
      }
      this._loadDailyAyah();
    });

    // Reciter change
    $('#reciterSelect')?.addEventListener('change', (e) => {
      const reciter = e.target.value;
      window.QuranStorage?.saveReciter(reciter);
      window.QuranAudio.setReciter(reciter);
      // Reload surah with new reciter audio
      if (this.currentSurah) {
        delete this.surahCache[this.currentSurah];
        this._loadSurah(this.currentSurah, this.currentAyahIndex);
      }
    });

    // Translation toggle
    $('#showTranslation')?.addEventListener('change', (e) => {
      const show = e.target.checked;
      window.QuranStorage?.saveShowTranslation(show);
      window.QuranUI.toggleTranslation(show);
    });

    // Tafsir toggle
    $('#showTafsir')?.addEventListener('change', (e) => {
      const show = e.target.checked;
      window.QuranStorage?.saveShowTafsir(show);
      window.QuranUI.toggleTafsir(show);
    });

    // Surah list navigation
    $('#surahList')?.addEventListener('click', (e) => {
      const li = e.target.closest('.surah-item');
      if (!li) return;
      const num = parseInt(li.dataset.number, 10);
      if (num) {
        window.location.hash = `/surah/${num}`;
        // Close sidebar on mobile
        window.QuranUI.toggleSidebar(false);
      }
    });

    // Surah search
    $('#surahSearch')?.addEventListener('input', (e) => {
      window.QuranUI.filterSurahList(e.target.value);
    });

    // Surah prev/next navigation
    const prevBtns = document.querySelectorAll('#prevSurahBtn, #prevSurahBtn2');
    const nextBtns = document.querySelectorAll('#nextSurahBtn, #nextSurahBtn2');
    prevBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.currentSurah && this.currentSurah > 1) {
          window.location.hash = `/surah/${this.currentSurah - 1}`;
        }
      });
    });
    nextBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.currentSurah && this.currentSurah < 114) {
          window.location.hash = `/surah/${this.currentSurah + 1}`;
        }
      });
    });

    // Mobile sidebar
    $('#menuToggle')?.addEventListener('click', () => {
      const isOpen = $('#sidebar')?.classList.contains('open');
      window.QuranUI.toggleSidebar(!isOpen);
    });
    $('#sidebarClose')?.addEventListener('click', () => window.QuranUI.toggleSidebar(false));
    $('#sidebarOverlay')?.addEventListener('click', () => window.QuranUI.toggleSidebar(false));

    // Scroll to top button
    $('#scrollTopBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      const btn = $('#scrollTopBtn');
      if (btn) btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this._isInputFocused()) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.QuranSearch?.toggle();
      }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); this.prevAyah(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); this.nextAyah(); }
      if (e.altKey && e.key === ' ') { e.preventDefault(); window.QuranAudio?.togglePlayPause(); }
    });
  }

  _applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const btn = $('#themeToggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  async _handleRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '') || '/';
    const parts = hash.split('/').filter(Boolean);

    if (!parts.length || parts[0] === '') {
      this._showHome();
    } else if (parts[0] === 'surah') {
      const num = parseInt(parts[1], 10);
      if (num >= 1 && num <= 114) {
        const ayahMatch = hash.match(/ayah-(\d+)/);
        const scrollTo = ayahMatch ? parseInt(ayahMatch[1], 10) : null;
        await this._loadSurah(num, scrollTo);
      } else {
        this._show404();
      }
    } else if (parts[0] === 'juzz') {
      this._showJuzz();
    } else if (parts[0] === 'bookmarks') {
      this._showBookmarks();
    } else if (parts[0] === 'random') {
      window.location.hash = `/surah/${Math.floor(Math.random() * 114) + 1}`;
    } else {
      this._show404();
    }
  }

  async _showHome() {
    window.QuranUI.showPage('pageHome');
    window.QuranUI.toggleSidebar(false);
    const dateEl = $('#dailyDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  }

  async _showSurah() {
    window.QuranUI.showPage('pageSurah');
    window.QuranUI.toggleSidebar(false);
  }

  async _loadSurah(num, scrollToAyahNum = null) {
    await this._showSurah();
    window.QuranUI.showLoading(true);

    const lang = window.QuranStorage?.loadLang() || 'en';
    const reciter = window.QuranStorage?.loadReciter() || 'ar.alafasy';

    this.currentSurah = num;
    this.currentAyahIndex = 0;

    // Check cache
    let data = this.surahCache[num];

    if (!data) {
      data = await window.QuranAPI.fetchSurahFull(num, lang, reciter);
      if (!data) {
        // Fallback to offline
        data = this._buildOfflineSurah(num);
      }
      this.surahCache[num] = data;
    }

    window.QuranUI.updatePageMeta(data);
    window.QuranUI.setActiveSurah(num);
    window.QuranUI.renderAyahs(data, { surahNum: num, lang });

    this._updateNavButtons(num);

    // Load into audio player
    window.QuranAudio?.loadSurah(data, 0);

    // Save reading position
    window.QuranStorage?.saveLastRead(num, 1);
    window.QuranStorage?.addToReadHistory(num);

    // Update SEO title
    document.title = `${data.englishName || data.name} — Quran Studio`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', `Read Surah ${data.englishName} (${data.englishNameTranslation}) with Arabic text, ${lang} translation, audio recitation, and tafsir. ${data.numberOfAyahs} Ayat.`);
    }

    // Scroll to specific ayah if requested
    if (scrollToAyahNum !== null) {
      setTimeout(() => this._scrollToAyah(scrollToAyahNum), 600);
    }

    window.QuranUI.showLoading(false);
  }

  _buildOfflineSurah(num) {
    const offlineList = window.QuranAPI.getOfflineSurahList();
    const info = offlineList.find(s => s.number === num) || offlineList[0];
    return {
      number: num,
      name: info.name || '',
      englishName: info.englishName || '',
      englishNameTranslation: info.englishNameTranslation || '',
      revelationType: info.revelationType || '',
      numberOfAyahs: info.numberOfAyahs || 7,
      ayahs: Array.from({ length: info.numberOfAyahs || 7 }, (_, i) => ({
        number: i + 1,
        quranNumber: 0,
        text: '',
        audio: null,
        translation: '',
        tafsir: null,
        audioError: true,
      })),
    };
  }

  _updateNavButtons(num) {
    document.querySelectorAll('#prevSurahBtn, #prevSurahBtn2').forEach(btn => {
      btn.style.opacity = num <= 1 ? '.3' : '1';
      btn.style.pointerEvents = num <= 1 ? 'none' : 'auto';
    });
    document.querySelectorAll('#nextSurahBtn, #nextSurahBtn2').forEach(btn => {
      btn.style.opacity = num >= 114 ? '.3' : '1';
      btn.style.pointerEvents = num >= 114 ? 'none' : 'auto';
    });
  }

  _scrollToAyah(ayahNum) {
    const el = document.querySelector(`.ayah-block[data-ayah="${ayahNum}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 2500);
    }
  }

  setCurrentAyah(index) {
    this.currentAyahIndex = index;
    window.QuranUI.highlightAyah(index);
    const data = this.surahCache[this.currentSurah];
    window.QuranUI.updateReadingProgress(
      this.currentSurah,
      index + 1,
      data?.numberOfAyahs || 0
    );
  }

  prevAyah() {
    if (this.currentAyahIndex > 0 && this.currentSurah) {
      this.setCurrentAyah(this.currentAyahIndex - 1);
      const ayah = this.surahCache[this.currentSurah]?.ayahs[this.currentAyahIndex];
      window.QuranAudio?.playAyah(ayah, ayah?.quranNumber, this.surahCache[this.currentSurah]);
    }
  }

  nextAyah() {
    const data = this.surahCache[this.currentSurah];
    if (this.currentAyahIndex < (data?.numberOfAyahs || 0) - 1 && this.currentSurah) {
      this.setCurrentAyah(this.currentAyahIndex + 1);
      const ayah = data?.ayahs[this.currentAyahIndex];
      window.QuranAudio?.playAyah(ayah, ayah?.quranNumber, data);
    }
  }

  async _showJuzz() {
    window.QuranUI.showPage('pageJuzz');
    window.QuranUI.toggleSidebar(false);
    document.title = 'Juzz (Parts) — Quran Studio';
  }

  async _showBookmarks() {
    window.QuranUI.showPage('pageBookmarks');
    window.QuranUI.toggleSidebar(false);
    window.QuranUI.renderBookmarks();
    document.title = 'Bookmarks — Quran Studio';
  }

  _show404() {
    window.QuranUI.showPage('page404');
    window.QuranUI.toggleSidebar(false);
    document.title = '404 — Quran Studio';
  }

  async _loadDailyAyah() {
    const card = $('#dailyCard');
    if (!card) return;

    if (window.QuranStorage?.isDailyCacheValid()) {
      const cached = window.QuranStorage.getDailyAyahCache();
      if (cached) { this._renderDailyAyah(cached); return; }
    }

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const surahNum = (dayOfYear % 114) + 1;
    const lang = window.QuranStorage?.loadLang() || 'en';

    card.innerHTML = '<div class="daily-loading"><div class="spinner"></div></div>';

    try {
      const data = await window.QuranAPI.fetchSurahFull(surahNum, lang);
      if (data && data.ayahs && data.ayahs.length > 0) {
        const ayahIdx = dayOfYear % data.ayahs.length;
        const ayah = data.ayahs[ayahIdx];
        const dailyData = {
          surahNum,
          surahName: data.englishName || '',
          surahArabic: data.name || '',
          ayahNum: ayah.number,
          arabic: ayah.text || '',
          translation: ayah.translation || '',
        };
        window.QuranStorage?.saveDailyAyahCache(dailyData);
        this._renderDailyAyah(dailyData);
      }
    } catch (e) {
      card.innerHTML = '<div class="daily-translation" style="text-align:center">Daily Ayah unavailable. Please connect to the internet.</div>';
    }
  }

  _renderDailyAyah(data) {
    const card = $('#dailyCard');
    if (!card) return;
    card.innerHTML = `
      <div class="surah-tag">📖 Surah ${data.surahNum} — ${data.surahName || ''}</div>
      <div class="daily-arabic">${data.arabic || ''}</div>
      ${data.translation ? `<div class="daily-translation">${data.translation}</div>` : ''}
      <div style="margin-top:16px">
        <a href="#/surah/${data.surahNum}" class="btn btn-secondary" style="padding:8px 20px;font-size:.9rem">Open Surah ${data.surahNum}</a>
      </div>
    `;
  }

  _setupPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = $('#installPWA');
      if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installBtn.style.display = 'none';
            deferredPrompt = null;
          }
        });
      }
    });
  }

  _isInputFocused() {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
  }
}

window.QuranApp = new QuranApp();
document.addEventListener('DOMContentLoaded', () => window.QuranApp.init());
