/**
 * Storage Module — LocalStorage persistence
 */

const PREFIX = 'quranStudio_';

const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      if (v === null || v === undefined) return fallback;
      return JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
  },
  remove(key) { try { localStorage.removeItem(PREFIX + key); } catch {} },
  clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};

// --- Theme ---
function loadTheme() { return storage.get('theme', 'dark'); }
function saveTheme(theme) { storage.set('theme', theme); }

// --- Language ---
function loadLang() { return storage.get('lang', 'en'); }
function saveLang(lang) { storage.set('lang', lang); }

// --- Reciter ---
function loadReciter() { return storage.get('reciter', 'ar.alafasy'); }
function saveReciter(id) { storage.set('reciter', id); }

// --- Autoplay ---
function loadAutoplay() { return storage.get('autoplay', true); }
function saveAutoplay(v) { storage.set('autoplay', !!v); }

// --- Volume ---
function loadVolume() { return storage.get('volume', 1); }
function saveVolume(v) { storage.set('volume', Math.max(0, Math.min(1, parseFloat(v)))); }

// --- Show Translation ---
function loadShowTranslation() { return storage.get('showTranslation', true); }
function saveShowTranslation(v) { storage.set('showTranslation', !!v); }

// --- Show Tafsir ---
function loadShowTafsir() { return storage.get('showTafsir', false); }
function saveShowTafsir(v) { storage.set('showTafsir', !!v); }

// --- Last Read Position ---
function loadLastRead() { return storage.get('lastRead', null); }
function saveLastRead(surah, ayah) {
  storage.set('lastRead', { surah, ayah, timestamp: Date.now() });
}

// --- Bookmarks ---
function getBookmarks() { return storage.get('bookmarks', []); }
function isBookmarked(surah, ayah) {
  return getBookmarks().some(b => Number(b.surah) === Number(surah) && Number(b.ayah) === Number(ayah));
}
function addBookmark(surah, ayah, data = {}) {
  if (isBookmarked(surah, ayah)) return;
  const list = getBookmarks();
  list.push({
    surah: Number(surah),
    ayah: Number(ayah),
    surahName: data.surahName || '',
    arabic: data.arabic || '',
    translation: data.translation || '',
    date: new Date().toISOString(),
  });
  storage.set('bookmarks', list);
}
function removeBookmark(surah, ayah) {
  const list = getBookmarks().filter(b => !(Number(b.surah) === Number(surah) && Number(b.ayah) === Number(ayah)));
  storage.set('bookmarks', list);
}
function toggleBookmark(surah, ayah, data = {}) {
  if (isBookmarked(surah, ayah)) removeBookmark(surah, ayah);
  else addBookmark(surah, ayah, data);
}

// --- Daily Ayah Cache ---
function getDailyAyahCache() { return storage.get('dailyAyah', null); }
function saveDailyAyahCache(data) { storage.set('dailyAyah', { ...data, cached: Date.now() }); }
function isDailyCacheValid() {
  const c = getDailyAyahCache();
  if (!c || !c.cached) return false;
  return Date.now() - c.cached < 24 * 60 * 60 * 1000; // 24h
}

// --- Reading History ---
function getReadHistory() { return storage.get('readHistory', []); }
function addToReadHistory(surah) {
  const hist = getReadHistory().filter(h => h !== surah);
  hist.unshift(surah);
  storage.set('readHistory', hist.slice(0, 20)); // keep last 20
}

window.QuranStorage = {
  loadTheme, saveTheme,
  loadLang, saveLang,
  loadReciter, saveReciter,
  loadAutoplay, saveAutoplay,
  loadVolume, saveVolume,
  loadShowTranslation, saveShowTranslation,
  loadShowTafsir, saveShowTafsir,
  loadLastRead, saveLastRead,
  getBookmarks, isBookmarked, addBookmark, removeBookmark, toggleBookmark,
  getDailyAyahCache, saveDailyAyahCache, isDailyCacheValid,
  getReadHistory, addToReadHistory,
};
