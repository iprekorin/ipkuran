/**
 * Quran Studio — UI Module v2
 * Ayah rendering with tafsir, translations, bookmark, and audio support
 */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// --- Render Surah List ---
function renderSurahList(surahs) {
  const list = $('#surahList');
  if (!list) return;
  list.innerHTML = '';
  surahs.forEach(s => {
    const li = document.createElement('li');
    li.className = 'surah-item';
    li.dataset.number = s.number;
    li.innerHTML = `
      <span class="surah-number">${s.number}</span>
      <div class="surah-item-info">
        <div class="surah-item-name">${s.englishName || s.name} <span style="opacity:.4;font-weight:400">${s.englishNameTranslation || ''}</span></div>
        <div class="surah-item-arabic">${s.name || ''}</div>
      </div>
      <span class="surah-item-meta">${s.numberOfAyahs} Ayahs<br>${s.revelationType || ''}</span>
    `;
    list.appendChild(li);
  });
}

function filterSurahList(query) {
  const q = query.toLowerCase().trim();
  $$('.surah-item').forEach(li => {
    const text = li.textContent.toLowerCase();
    li.style.display = text.includes(q) ? '' : 'none';
  });
}

function setActiveSurah(number) {
  $$('.surah-item').forEach(li => {
    li.classList.toggle('active', Number(li.dataset.number) === Number(number));
  });
}

// --- Render Ayahs with Translation + Tafsir ---
let currentTafsirData = {};
let tafsirLoadingState = {};
let showTranslationState = true;
let showTafsirState = false;

function renderAyahs(data, options = {}) {
  const container = $('#ayahsContainer');
  if (!container) return;

  const { surahNum, lang } = options;
  showTranslationState = window.QuranStorage?.loadShowTranslation() ?? true;
  showTafsirState = window.QuranStorage?.loadShowTafsir() ?? false;

  container.innerHTML = '';
  currentTafsirData = {};
  tafsirLoadingState = {};
  tafsirCacheLoaded[surahNum] = false; // Reset tafsir cache flag for this surah

  const ayahs = data.ayahs || [];

  ayahs.forEach((ayah, idx) => {
    const isBooked = window.QuranStorage?.isBookmarked(surahNum, ayah.number) || false;

    const div = document.createElement('div');
    div.className = 'ayah-block';
    div.dataset.index = idx;
    div.dataset.ayah = ayah.number;
    div.dataset.quranNum = ayah.quranNumber || 0;

    const transVisible = showTranslationState && ayah.translation ? ' visible' : '';
    const tafsirHtml = `
      <div class="ayah-tafsir${showTafsirState ? ' visible' : ''}" data-tafsir-ayah="${ayah.number}" id="tafsir-${surahNum}-${ayah.number}">
        <div class="tafsir-loading" style="display:flex;align-items:center;gap:8px;padding:8px 0">
          <div class="spinner" style="width:16px;height:16px;border-width:2px"></div>
          <span style="font-size:.8rem;color:var(--text-muted)">Loading tafsir…</span>
        </div>
        <div class="tafsir-text" style="display:none"></div>
        <div class="tafsir-error" style="display:none;color:var(--text-muted);font-size:.85rem;padding:8px 0">Tafsir unavailable</div>
      </div>
    `;

    const audioBtnClass = ayah.audioError ? 'ayah-audio-btn audio-error' : 'ayah-audio-btn';
    const audioBtnText = ayah.audioError ? '⚠ Audio unavailable' : '▶ Listen';

    div.innerHTML = `
      <div class="ayah-header">
        <div class="ayah-number-badge">
          <span class="ayah-num">${ayah.number}</span>
        </div>
        <div class="ayah-actions">
          <button class="ayah-action-btn bookmark-btn${isBooked ? ' bookmarked' : ''}"
                  title="${isBooked ? 'Remove bookmark' : 'Bookmark this Ayah'}"
                  aria-label="${isBooked ? 'Remove bookmark' : 'Bookmark this Ayah'}"
                  data-surah="${surahNum}" data-ayah="${ayah.number}">
            ${isBooked ? '★' : '☆'}
          </button>
          <button class="ayah-action-btn play-ayah-btn" title="Play audio" aria-label="Play audio"
                  data-url="${ayah.audio || ''}" data-quran-num="${ayah.quranNumber || 0}">
            ▶
          </button>
        </div>
      </div>
      <div class="ayah-arabic">${ayah.text || ''}</div>
      ${ayah.translation ? `<div class="ayah-translation${transVisible}">${ayah.translation}</div>` : ''}
      ${tafsirHtml}
      ${ayah.audio && !ayah.audioError ? `<button class="${audioBtnClass}" data-url="${ayah.audio}" data-quran-num="${ayah.quranNumber || 0}">${audioBtnText}</button>` : ''}
    `;

    // Bookmark toggle
    const bmBtn = div.querySelector('.bookmark-btn');
    if (bmBtn) {
      bmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sNum = parseInt(bmBtn.dataset.surah, 10);
        const aNum = parseInt(bmBtn.dataset.ayah, 10);
        const ayahData = ayahs.find(a => a.number === aNum);
        window.QuranStorage?.toggleBookmark(sNum, aNum, {
          surahName: data.englishName || '',
          arabic: ayahData?.text || '',
          translation: ayahData?.translation || '',
        });
        const nowBooked = window.QuranStorage?.isBookmarked(sNum, aNum) || false;
        bmBtn.classList.toggle('bookmarked', nowBooked);
        bmBtn.textContent = nowBooked ? '★' : '☆';
        bmBtn.title = nowBooked ? 'Remove bookmark' : 'Bookmark this Ayah';
      });
    }

    // Play audio click (from action button)
    const playBtn = div.querySelector('.play-ayah-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const quranNum = parseInt(playBtn.dataset.quranNum, 10) || ayah.quranNumber;
        if (window.QuranAudio && ayah) {
          window.QuranAudio.playAyah(ayah, quranNum, data);
        }
      });
    }

    // Play audio click (from bottom button)
    const audioBtn = div.querySelector('.ayah-audio-btn');
    if (audioBtn && !audioBtn.classList.contains('audio-error')) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const quranNum = parseInt(audioBtn.dataset.quranNum, 10) || ayah.quranNumber;
        if (window.QuranAudio && ayah) {
          window.QuranAudio.playAyah(ayah, quranNum, data);
        }
      });
    }

    // Click ayah to highlight
    div.addEventListener('click', () => {
      if (window.QuranApp) {
        window.QuranApp.setCurrentAyah(idx);
        window.QuranStorage?.saveLastRead(surahNum, ayah.number);
      }
    });

    container.appendChild(div);
  });

  // If tafsir is enabled, load it for all ayahs
  if (showTafsirState) {
    loadTafsirForSurah(surahNum, ayahs.length);
  }
}

// --- Load Tafsir for all Ayahs in a Surah ---
const tafsirCacheLoaded = {};

async function loadTafsirForSurah(surahNum, ayahCount) {
  if (tafsirCacheLoaded[surahNum]) return; // Already loaded
  tafsirCacheLoaded[surahNum] = true;

  for (let i = 1; i <= ayahCount; i++) {
    const el = document.getElementById(`tafsir-${surahNum}-${i}`);
    if (!el) continue;

    el.querySelector('.tafsir-loading').style.display = 'none';
    el.querySelector('.tafsir-text').style.display = 'block';
    el.querySelector('.tafsir-text').innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';

    const text = await window.QuranAPI.fetchAyahTafsir(surahNum, i);
    const textEl = el.querySelector('.tafsir-text');
    const errEl = el.querySelector('.tafsir-error');

    if (text) {
      textEl.innerHTML = `<p>${text}</p>`;
      errEl.style.display = 'none';
    } else {
      textEl.innerHTML = '';
      textEl.style.display = 'none';
      errEl.style.display = 'block';
    }
  }
}

// --- Toggle Translation ---
function toggleTranslation(show) {
  showTranslationState = show;
  $$('.ayah-translation').forEach(el => {
    el.classList.toggle('visible', show);
  });
}

// --- Toggle Tafsir ---
function toggleTafsir(show) {
  showTafsirState = show;
  $$('.ayah-tafsir').forEach(el => {
    el.classList.toggle('visible', show);
  });

  // Load tafsir if enabled and not yet loaded
  if (show) {
    const allAyat = $$('.ayah-block');
    if (allAyat.length > 0) {
      const sNum = parseInt(window.QuranApp?.currentSurah, 10);
      if (sNum) loadTafsirForSurah(sNum, allAyat.length);
    }
  }
}

// --- Highlight Ayah ---
function highlightAyah(index) {
  $$('.ayah-block').forEach((el, i) => {
    el.classList.toggle('active', i === index);
    if (i === index) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// --- Set Playing Ayah (update play button state) ---
function setPlayingAyah(index) {
  $$('.ayah-block').forEach((el, i) => {
    const mainBtn = el.querySelector('.ayah-audio-btn');
    const playBtn = el.querySelector('.play-ayah-btn');

    if (i === index) {
      el.classList.add('playing');
      if (mainBtn && !mainBtn.classList.contains('audio-error')) {
        mainBtn.classList.add('playing');
        mainBtn.textContent = '⏸ Now playing';
      }
      if (playBtn) {
        playBtn.textContent = '⏸';
        playBtn.classList.add('playing');
      }
    } else {
      el.classList.remove('playing');
      if (mainBtn && !mainBtn.classList.contains('audio-error')) {
        mainBtn.classList.remove('playing');
        mainBtn.textContent = '▶ Listen';
      }
      if (playBtn) {
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
      }
    }
  });
}

// --- Update Reading Progress ---
function updateReadingProgress(surahNum, ayahNum, total) {
  const el = $('#readingProgress');
  if (!el) return;
  const pct = total > 0 ? Math.round((ayahNum / total) * 100) : 0;
  el.textContent = `${ayahNum} / ${total} (${pct}%)`;
}

// --- Render Juzz Grid ---
function renderJuzzGrid() {
  const grid = $('#juzzGrid');
  if (!grid) return;
  const juzzNames = [
    'Alif Lam Mim', 'Sayaqool', 'Tilkal Mursefat', 'Fab ayyi', 'Wal Mohsanat', 'La Yuhibbu',
    'Wa Idza Samiu', 'Wa Lau Annana', 'Qaalal Malik', 'Wa Ma Min Da', 'Yatazeroon',
    'Wa Idza Samiu', 'Wa Ma Aminkum', 'Ha Meem', 'Robaana', 'Soma Alaka', 'Qal Ho', 'Alam Tara',
    'Qal Tou', 'Wa Qalal', 'Wa Ma Li', 'Mimmam', 'Qal', 'Wa Ma Yaqul',
    'Ya Sin', 'Wa Az-Zikri', 'Fasabbih', 'Qal', 'Wa Manya Yatalaththab', 'Qal Ma',
  ];
  grid.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    const card = document.createElement('div');
    card.className = 'juzz-card';
    card.innerHTML = `
      <div class="juzz-num">${i}</div>
      <div class="juzz-name">Juzz ${i}</div>
      <div class="juzz-range">${juzzNames[i - 1] || ''}</div>
    `;
    card.addEventListener('click', () => {
      const firstSurah = [1,2,2,3,4,5,6,7,8,9,11,12,14,16,18,20,22,24,26,27,29,33,36,38,40,41,43,46,51,58][i - 1] || 1;
      window.location.hash = `/surah/${firstSurah}`;
    });
    grid.appendChild(card);
  }
}

// --- Render Bookmarks ---
function renderBookmarks() {
  const container = $('#bookmarksContainer');
  if (!container) return;
  const bookmarks = window.QuranStorage?.getBookmarks() || [];
  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div class="not-found">
        <div class="not-found-icon">⭐</div>
        <h1>No Bookmarks</h1>
        <p>Star your favorite Ayahs to save them here</p>
        <a href="#/" class="btn btn-primary" style="margin-top:16px">Start Reading</a>
      </div>
    `;
    return;
  }
  container.innerHTML = '';
  bookmarks.forEach(b => {
    const div = document.createElement('div');
    div.className = 'bookmark-item';
    div.innerHTML = `
      <div class="bookmark-info">
        <div class="bookmark-surah">Surah ${b.surah} — Ayah ${b.ayah} ${b.surahName ? `(${b.surahName})` : ''}</div>
        <div class="bookmark-arabic">${b.arabic || ''}</div>
        ${b.translation ? `<div class="bookmark-translation">${b.translation}</div>` : ''}
      </div>
      <button class="bookmark-remove" aria-label="Remove bookmark">✕</button>
    `;
    div.querySelector('.bookmark-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      window.QuranStorage?.removeBookmark(b.surah, b.ayah);
      renderBookmarks();
    });
    div.addEventListener('click', () => {
      window.location.hash = `/surah/${b.surah}#ayah-${b.ayah}`;
    });
    container.appendChild(div);
  });
}

// --- Page helpers ---
function showPage(pageId) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const page = $(`#${pageId}`);
  if (page) {
    page.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showLoading(show = true) {
  const overlay = $('#loadingOverlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !show);
}

function updatePageMeta(surahData) {
  if (!surahData) return;
  const displayName = $('#surahDisplayName');
  const nameDisplay = $('#surahNameDisplay');
  const metaDisplay = $('#surahMetaDisplay');
  if (displayName) displayName.textContent = surahData.name || '';
  if (nameDisplay) nameDisplay.textContent = `${surahData.englishName || ''} — ${surahData.englishNameTranslation || ''}`;
  if (metaDisplay) metaDisplay.textContent = `${surahData.revelationType || ''} • ${surahData.numberOfAyahs || 0} Ayat`;
}

function toggleSidebar(open) {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  const menuToggle = $('#menuToggle');
  if (!sidebar) return;
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('active', open);
  menuToggle?.classList.toggle('active', open);
}

window.QuranUI = {
  renderSurahList, filterSurahList, setActiveSurah,
  renderAyahs, highlightAyah, setPlayingAyah,
  updateReadingProgress, renderJuzzGrid, renderBookmarks,
  showPage, showLoading, updatePageMeta, toggleSidebar,
  toggleTranslation, toggleTafsir, loadTafsirForSurah,
};
