/**
 * Quran Studio — API Module v2
 * Properly handles translations, audio reciters, and tafsir
 */

const API_BASE = 'https://api.alquran.cloud/v1';

const RECITER_MAP = {
  'ar.alafasy':           { name: 'Mishary Rashid Alafasy',  tqpId: 1 },
  'ar.abdurrahmaansudais': { name: 'Abu Bakr Al Shatri',       tqpId: 2 },
  'ar.mahermuaiqly':      { name: 'Nasser Al Qatami',          tqpId: 3 },
  'ar.husary':            { name: 'Yasser Al Dosari',           tqpId: 4 },
  'ar.husarymujawwad':    { name: 'Hani Ar Rifai',            tqpId: 5 },
  'ar.ahmedajamy':        { name: 'Ahmed Al Ajamy',            tqpId: null },
  'ar.minshawimujawwad':  { name: 'Al-Minshawy (Mujawwad)',   tqpId: null },
  'ar.muhammadjibreel':   { name: 'Muhammad Jibreel',         tqpId: null },
  'ar.abdulbasityouth':   { name: 'Abdul Basit Youth',         tqpId: null },
};

const IN_CDN = 'https://cdn.islamic.network/quran/audio/128';
const TQP_CDN = 'https://the-quran-project.github.io/Quran-Audio/Data';

// Get reciter info by ID
function getReciterInfo(reciterId) {
  return RECITER_MAP[reciterId] || RECITER_MAP['ar.alafasy'];
}

// Build audio URL for a specific ayah using confirmed working sources
function buildAudioUrl(surahNumber, ayahNumber, reciterId = 'ar.alafasy') {
  if (!surahNumber || !ayahNumber) return null;
  const info = RECITER_MAP[reciterId] || RECITER_MAP['ar.alafasy'];
  if (reciterId === 'ar.alafasy') {
    return null;
  }
  if (info?.tqpId) {
    return `${TQP_CDN}/${info.tqpId}/${surahNumber}_${ayahNumber}.mp3`;
  }
  return null;
}

// Internal: get Islamic Network CDN URL for Mishary
function _getInCdnUrl(quranNumber) {
  if (quranNumber > 0) return `${IN_CDN}/ar.alafasy/${quranNumber}.mp3`;
  return null;
}

// Get all reciters list
function getReciters() {
  return Object.entries(RECITER_MAP).map(([id, info]) => ({
    id,
    name: info.name,
    hasAudio: info.tqpId !== null,
  }));
}

// Language code map
const LANG_MAP = {
  en: 'en.sahih',    // Sahih International
  fr: 'fr.hamid',    // French
  ru: 'ru.kuliev',   // Russian
  ur: 'ur.ahmedali', // Urdu
  id: 'id.indonesian', // Indonesian
  ar: 'ar.jalalayn', // Arabic (tafsir style)
  tr: 'tr.diyanet',  // Turkish
  de: 'de.bubenheim', // German
  es: 'es.borja',    // Spanish
  fa: 'fa.ansarian', // Persian
  ms: 'ms.basmeih',  // Malay
  bn: 'bn.banani',   // Bengali
  hi: 'hi.farooq',   // Hindi
};

function getTranslationEdition(lang) {
  return LANG_MAP[lang] || 'en.sahih';
}

// --- Surah List ---
async function fetchSurahList() {
  try {
    const res = await fetch(`${API_BASE}/surah`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.data) return json.data;
  } catch (e) {
    console.warn('[API] Surah list fetch failed:', e.message);
  }
  return getOfflineSurahList();
}

// --- Fetch full Surah with all needed data ---
async function fetchSurahFull(surahNumber, lang = 'en', reciterId = 'ar.alafasy') {
  const translationEd = getTranslationEdition(lang);

  try {
    // Fetch Arabic text, translation, and audio (if Mishary) in parallel
    const requests = [
      fetch(`${API_BASE}/surah/${surahNumber}`),
      fetch(`${API_BASE}/surah/${surahNumber}/${translationEd}`),
    ];
    // Add Mishary audio edition if using Mishary (gets reliable CDN URLs from API)
    if (reciterId === 'ar.alafasy') {
      requests.push(fetch(`${API_BASE}/surah/${surahNumber}/ar.alafasy`));
    }

    const results = await Promise.all(requests);

    let arData = null, transData = null, audioData = null;

    if (results[0].ok) {
      const j = await results[0].json();
      if (j?.data) arData = j.data;
    }
    if (results[1].ok) {
      const j = await results[1].json();
      if (j?.data) transData = j.data;
    }
    // results[2] is Mishary audio edition (optional)
    if (reciterId === 'ar.alafasy' && results[2]?.ok) {
      const j = await results[2].json();
      if (j?.data) audioData = j.data;
    }

    if (!arData) throw new Error('No Arabic text data');

    return buildSurahData(arData, transData, surahNumber, reciterId, audioData);
  } catch (e) {
    console.warn(`[API] fetchSurahFull(${surahNumber}) failed:`, e.message);
  }
  return null;
}

// Build unified Surah data object from API responses
function buildSurahData(textData, transData, surahNumber, reciterId, audioData) {
  const textAyahs = textData.ayahs || [];
  const transAyahs = transData?.ayahs || [];
  const audioAyahs = audioData?.ayahs || [];

  const ayahs = textAyahs.map((a, idx) => {
    const surahNum = textData.number || surahNumber;
    const ayahNum = a.numberInSurah || idx + 1;
    const quranNum = a.numberInQuran || 0;
    const reciterInfo = RECITER_MAP[reciterId] || RECITER_MAP['ar.alafasy'];

    let audioUrl = null;
    if (reciterId === 'ar.alafasy' && audioAyahs.length > 0) {
      const audioAyah = audioAyahs.find(au => au.numberInSurah === ayahNum);
      audioUrl = audioAyah?.audio || null;
      if (!audioUrl && quranNum > 0) {
        audioUrl = `${IN_CDN}/ar.alafasy/${quranNum}.mp3`;
      }
    } else if (reciterInfo?.tqpId) {
      audioUrl = `${TQP_CDN}/${reciterInfo.tqpId}/${surahNum}_${ayahNum}.mp3`;
    }

    // Match translation by ayah number
    const transAyah = transAyahs.find(t => t.numberInSurah === a.numberInSurah);
    const translation = transAyah?.text || '';

    return {
      number: ayahNum,
      quranNumber: quranNum,
      text: a.text || '',
      audio: audioUrl,
      translation: translation,
      tafsir: null,
      audioError: false,
    };
  });

  return {
    number: textData.number || surahNumber,
    name: textData.name || '',
    englishName: textData.englishName || '',
    englishNameTranslation: textData.englishNameTranslation || '',
    revelationType: textData.revelationType || '',
    numberOfAyahs: textData.numberOfAyahs || ayahs.length,
    ayahs,
  };
}

// --- Fetch Tafsir for a specific Ayah ---
const tafsirCache = {};

async function fetchAyahTafsir(surahNumber, ayahNumber, tafsirType = 'en.sahih') {
  const cacheKey = `${surahNumber}:${ayahNumber}:${tafsirType}`;
  if (tafsirCache[cacheKey]) return tafsirCache[cacheKey];

  try {
    const res = await fetch(`${API_BASE}/tafsir/${surahNumber}/${ayahNumber}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.data) {
      let text = '';
      // Different tafsir sources have different response structures
      if (json.data.text) text = json.data.text;
      else if (typeof json.data === 'string') text = json.data;

      // Clean HTML tags if present
      text = cleanHtml(text);
      tafsirCache[cacheKey] = text;
      return text;
    }
  } catch (e) {
    console.warn(`[API] Tafsir fetch failed (${surahNumber}:${ayahNumber}):`, e.message);
  }

  tafsirCache[cacheKey] = null;
  return null;
}

// Clean basic HTML tags
function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// --- Fetch Tafsir for all Ayahs in a Surah (batch) ---
async function fetchSurahTafsir(surahNumber, ayahCount, tafsirType = 'en.sahih') {
  const results = {};
  // Fetch in batches of 5 to avoid rate limiting
  for (let i = 1; i <= ayahCount; i += 5) {
    const batch = [];
    for (let j = i; j < i + 5 && j <= ayahCount; j++) {
      batch.push(fetchAyahTafsir(surahNumber, j, tafsirType));
    }
    const batchResults = await Promise.all(batch);
    batchResults.forEach((tafsir, idx) => {
      results[i + idx] = tafsir;
    });
  }
  return results;
}

// --- Search ---
async function searchQuran(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const edition = getTranslationEdition(getCurrentLang());
    const res = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}/all/${edition}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.data && json.data.matches) {
      return json.data.matches.slice(0, 30).map(m => ({
        surah: m.surah?.number || 0,
        surahName: m.surah?.englishName || '',
        surahArabic: m.surah?.name || '',
        ayah: m.numberInSurah || 0,
        text: m.text || '',
        translation: m.text || '',
      }));
    }
  } catch (e) {
    console.warn('[API] Search failed:', e.message);
  }
  return [];
}

// --- Offline Surah List ---
function getOfflineSurahList() {
  return [
    { number: 1, name: 'Al-Fatihah', englishName: 'Al-Fatihah', englishNameTranslation: 'The Opening', revelationType: 'Meccan', numberOfAyahs: 7 },
    { number: 2, name: 'Al-Baqarah', englishName: 'Al-Baqarah', englishNameTranslation: 'The Cow', revelationType: 'Madinan', numberOfAyahs: 286 },
    { number: 3, name: 'Ali Imran', englishName: 'Ali Imran', englishNameTranslation: 'The Family of Imran', revelationType: 'Madinan', numberOfAyahs: 200 },
    { number: 4, name: 'An-Nisa', englishName: 'An-Nisa', englishNameTranslation: 'The Women', revelationType: 'Madinan', numberOfAyahs: 176 },
    { number: 5, name: 'Al-Ma\'idah', englishName: 'Al-Ma\'idah', englishNameTranslation: 'The Table Spread', revelationType: 'Madinan', numberOfAyahs: 120 },
    { number: 6, name: 'Al-An\'am', englishName: 'Al-An\'am', englishNameTranslation: 'The Cattle', revelationType: 'Meccan', numberOfAyahs: 165 },
    { number: 7, name: 'Al-A\'raf', englishName: 'Al-A\'raf', englishNameTranslation: 'The Heights', revelationType: 'Meccan', numberOfAyahs: 206 },
    { number: 8, name: 'Al-Anfal', englishName: 'Al-Anfal', englishNameTranslation: 'The Spoils of War', revelationType: 'Madinan', numberOfAyahs: 75 },
    { number: 9, name: 'At-Tawbah', englishName: 'At-Tawbah', englishNameTranslation: 'The Repentance', revelationType: 'Madinan', numberOfAyahs: 129 },
    { number: 10, name: 'Yunus', englishName: 'Yunus', englishNameTranslation: 'Jonah', revelationType: 'Meccan', numberOfAyahs: 109 },
    { number: 11, name: 'Hud', englishName: 'Hud', englishNameTranslation: 'Hud', revelationType: 'Meccan', numberOfAyahs: 123 },
    { number: 12, name: 'Yusuf', englishName: 'Yusuf', englishNameTranslation: 'Joseph', revelationType: 'Meccan', numberOfAyahs: 111 },
    { number: 13, name: 'Ar-Ra\'d', englishName: 'Ar-Ra\'d', englishNameTranslation: 'The Thunder', revelationType: 'Madinan', numberOfAyahs: 43 },
    { number: 14, name: 'Ibrahim', englishName: 'Ibrahim', englishNameTranslation: 'Abraham', revelationType: 'Meccan', numberOfAyahs: 52 },
    { number: 15, name: 'Al-Hijr', englishName: 'Al-Hijr', englishNameTranslation: 'The Rocky Tract', revelationType: 'Meccan', numberOfAyahs: 99 },
    { number: 16, name: 'An-Nahl', englishName: 'An-Nahl', englishNameTranslation: 'The Bee', revelationType: 'Meccan', numberOfAyahs: 128 },
    { number: 17, name: 'Al-Isra', englishName: 'Al-Isra', englishNameTranslation: 'The Night Journey', revelationType: 'Meccan', numberOfAyahs: 111 },
    { number: 18, name: 'Al-Kahf', englishName: 'Al-Kahf', englishNameTranslation: 'The Cave', revelationType: 'Meccan', numberOfAyahs: 110 },
    { number: 19, name: 'Maryam', englishName: 'Maryam', englishNameTranslation: 'Mary', revelationType: 'Meccan', numberOfAyahs: 98 },
    { number: 20, name: 'Ta-Ha', englishName: 'Ta-Ha', englishNameTranslation: 'Ta-Ha', revelationType: 'Meccan', numberOfAyahs: 135 },
    { number: 21, name: 'Al-Anbiya', englishName: 'Al-Anbiya', englishNameTranslation: 'The Prophets', revelationType: 'Meccan', numberOfAyahs: 112 },
    { number: 22, name: 'Al-Hajj', englishName: 'Al-Hajj', englishNameTranslation: 'The Pilgrimage', revelationType: 'Madinan', numberOfAyahs: 78 },
    { number: 23, name: 'Al-Mu\'minun', englishName: 'Al-Mu\'minun', englishNameTranslation: 'The Believers', revelationType: 'Meccan', numberOfAyahs: 118 },
    { number: 24, name: 'An-Nur', englishName: 'An-Nur', englishNameTranslation: 'The Light', revelationType: 'Madinan', numberOfAyahs: 64 },
    { number: 25, name: 'Al-Furqan', englishName: 'Al-Furqan', englishNameTranslation: 'The Criterion', revelationType: 'Meccan', numberOfAyahs: 77 },
    { number: 26, name: 'Ash-Shu\'ara', englishName: 'Ash-Shu\'ara', englishNameTranslation: 'The Poets', revelationType: 'Meccan', numberOfAyahs: 227 },
    { number: 27, name: 'An-Naml', englishName: 'An-Naml', englishNameTranslation: 'The Ant', revelationType: 'Meccan', numberOfAyahs: 93 },
    { number: 28, name: 'Al-Qasas', englishName: 'Al-Qasas', englishNameTranslation: 'The Stories', revelationType: 'Meccan', numberOfAyahs: 88 },
    { number: 29, name: 'Al-Ankabut', englishName: 'Al-Ankabut', englishNameTranslation: 'The Spider', revelationType: 'Meccan', numberOfAyahs: 69 },
    { number: 30, name: 'Ar-Rum', englishName: 'Ar-Rum', englishNameTranslation: 'The Romans', revelationType: 'Meccan', numberOfAyahs: 60 },
    { number: 31, name: 'Luqman', englishName: 'Luqman', englishNameTranslation: 'Luqman', revelationType: 'Meccan', numberOfAyahs: 34 },
    { number: 32, name: 'As-Sajdah', englishName: 'As-Sajdah', englishNameTranslation: 'The Prostration', revelationType: 'Meccan', numberOfAyahs: 30 },
    { number: 33, name: 'Al-Ahzab', englishName: 'Al-Ahzab', englishNameTranslation: 'The Combined Forces', revelationType: 'Madinan', numberOfAyahs: 73 },
    { number: 34, name: 'Saba', englishName: 'Saba', englishNameTranslation: 'Sheba', revelationType: 'Meccan', numberOfAyahs: 54 },
    { number: 35, name: 'Fatir', englishName: 'Fatir', englishNameTranslation: 'Originator', revelationType: 'Meccan', numberOfAyahs: 45 },
    { number: 36, name: 'Ya-Sin', englishName: 'Ya-Sin', englishNameTranslation: 'Ya Sin', revelationType: 'Meccan', numberOfAyahs: 83 },
    { number: 37, name: 'As-Saffat', englishName: 'As-Saffat', englishNameTranslation: 'Those Who Set The Ranks', revelationType: 'Meccan', numberOfAyahs: 182 },
    { number: 38, name: 'Sad', englishName: 'Sad', englishNameTranslation: 'The Letter Sad', revelationType: 'Meccan', numberOfAyahs: 88 },
    { number: 39, name: 'Az-Zumar', englishName: 'Az-Zumar', englishNameTranslation: 'The Troops', revelationType: 'Meccan', numberOfAyahs: 75 },
    { number: 40, name: 'Ghafir', englishName: 'Ghafir', englishNameTranslation: 'The Forgiver', revelationType: 'Meccan', numberOfAyahs: 85 },
    { number: 41, name: 'Fussilat', englishName: 'Fussilat', englishNameTranslation: 'Explained in Detail', revelationType: 'Meccan', numberOfAyahs: 54 },
    { number: 42, name: 'Ash-Shura', englishName: 'Ash-Shura', englishNameTranslation: 'The Consultation', revelationType: 'Meccan', numberOfAyahs: 53 },
    { number: 43, name: 'Az-Zukhruf', englishName: 'Az-Zukhruf', englishNameTranslation: 'The Ornaments of Gold', revelationType: 'Meccan', numberOfAyahs: 89 },
    { number: 44, name: 'Ad-Dukhan', englishName: 'Ad-Dukhan', englishNameTranslation: 'The Smoke', revelationType: 'Meccan', numberOfAyahs: 59 },
    { number: 45, name: 'Al-Jathiyah', englishName: 'Al-Jathiyah', englishNameTranslation: 'The Crouching', revelationType: 'Meccan', numberOfAyahs: 37 },
    { number: 46, name: 'Al-Ahqaf', englishName: 'Al-Ahqaf', englishNameTranslation: 'The Wind-Curved Sandhills', revelationType: 'Meccan', numberOfAyahs: 35 },
    { number: 47, name: 'Muhammad', englishName: 'Muhammad', englishNameTranslation: 'Muhammad', revelationType: 'Madinan', numberOfAyahs: 38 },
    { number: 48, name: 'Al-Fath', englishName: 'Al-Fath', englishNameTranslation: 'The Victory', revelationType: 'Madinan', numberOfAyahs: 29 },
    { number: 49, name: 'Al-Hujurat', englishName: 'Al-Hujurat', englishNameTranslation: 'The Rooms', revelationType: 'Madinan', numberOfAyahs: 18 },
    { number: 50, name: 'Qaf', englishName: 'Qaf', englishNameTranslation: 'The Letter Qaf', revelationType: 'Meccan', numberOfAyahs: 45 },
    { number: 51, name: 'Adh-Dhariyat', englishName: 'Adh-Dhariyat', englishNameTranslation: 'The Winnowing Winds', revelationType: 'Meccan', numberOfAyahs: 60 },
    { number: 52, name: 'At-Tur', englishName: 'At-Tur', englishNameTranslation: 'The Mount', revelationType: 'Meccan', numberOfAyahs: 49 },
    { number: 53, name: 'An-Najm', englishName: 'An-Najm', englishNameTranslation: 'The Star', revelationType: 'Meccan', numberOfAyahs: 62 },
    { number: 54, name: 'Al-Qamar', englishName: 'Al-Qamar', englishNameTranslation: 'The Moon', revelationType: 'Meccan', numberOfAyahs: 55 },
    { number: 55, name: 'Ar-Rahman', englishName: 'Ar-Rahman', englishNameTranslation: 'The Beneficent', revelationType: 'Madinan', numberOfAyahs: 78 },
    { number: 56, name: 'Al-Waqi\'ah', englishName: 'Al-Waqi\'ah', englishNameTranslation: 'The Inevitable', revelationType: 'Meccan', numberOfAyahs: 96 },
    { number: 57, name: 'Al-Hadid', englishName: 'Al-Hadid', englishNameTranslation: 'The Iron', revelationType: 'Madinan', numberOfAyahs: 29 },
    { number: 58, name: 'Al-Mujadila', englishName: 'Al-Mujadila', englishNameTranslation: 'The Pleading Woman', revelationType: 'Madinan', numberOfAyahs: 22 },
    { number: 59, name: 'Al-Hashr', englishName: 'Al-Hashr', englishNameTranslation: 'The Exile', revelationType: 'Madinan', numberOfAyahs: 24 },
    { number: 60, name: 'Al-Mumtahanah', englishName: 'Al-Mumtahanah', englishNameTranslation: 'She That Is Examined', revelationType: 'Madinan', numberOfAyahs: 13 },
    { number: 61, name: 'As-Saf', englishName: 'As-Saf', englishNameTranslation: 'The Ranks', revelationType: 'Madinan', numberOfAyahs: 14 },
    { number: 62, name: 'Al-Jumu\'ah', englishName: 'Al-Jumu\'ah', englishNameTranslation: 'The Congregation', revelationType: 'Madinan', numberOfAyahs: 11 },
    { number: 63, name: 'Al-Munafiqun', englishName: 'Al-Munafiqun', englishNameTranslation: 'The Hypocrites', revelationType: 'Madinan', numberOfAyahs: 11 },
    { number: 64, name: 'At-Taghabun', englishName: 'At-Taghabun', englishNameTranslation: 'The Mutual Disillusion', revelationType: 'Madinan', numberOfAyahs: 18 },
    { number: 65, name: 'At-Talaq', englishName: 'At-Talaq', englishNameTranslation: 'The Divorce', revelationType: 'Madinan', numberOfAyahs: 12 },
    { number: 66, name: 'At-Tahrim', englishName: 'At-Tahrim', englishNameTranslation: 'The Prohibition', revelationType: 'Madinan', numberOfAyahs: 12 },
    { number: 67, name: 'Al-Mulk', englishName: 'Al-Mulk', englishNameTranslation: 'The Sovereignty', revelationType: 'Meccan', numberOfAyahs: 30 },
    { number: 68, name: 'Al-Qalam', englishName: 'Al-Qalam', englishNameTranslation: 'The Pen', revelationType: 'Meccan', numberOfAyahs: 52 },
    { number: 69, name: 'Al-Haqqah', englishName: 'Al-Haqqah', englishNameTranslation: 'The Reality', revelationType: 'Meccan', numberOfAyahs: 52 },
    { number: 70, name: 'Al-Ma\'arij', englishName: 'Al-Ma\'arij', englishNameTranslation: 'The Ascending Stairways', revelationType: 'Meccan', numberOfAyahs: 44 },
    { number: 71, name: 'Nuh', englishName: 'Nuh', englishNameTranslation: 'Noah', revelationType: 'Meccan', numberOfAyahs: 28 },
    { number: 72, name: 'Al-Jinn', englishName: 'Al-Jinn', englishNameTranslation: 'The Jinn', revelationType: 'Meccan', numberOfAyahs: 28 },
    { number: 73, name: 'Al-Muzzammil', englishName: 'Al-Muzzammil', englishNameTranslation: 'The Enshrouded One', revelationType: 'Meccan', numberOfAyahs: 20 },
    { number: 74, name: 'Al-Muddaththir', englishName: 'Al-Muddaththir', englishNameTranslation: 'The Cloaked One', revelationType: 'Meccan', numberOfAyahs: 56 },
    { number: 75, name: 'Al-Qiyamah', englishName: 'Al-Qiyamah', englishNameTranslation: 'The Resurrection', revelationType: 'Meccan', numberOfAyahs: 40 },
    { number: 76, name: 'Al-Insan', englishName: 'Al-Insan', englishNameTranslation: 'The Man', revelationType: 'Madinan', numberOfAyahs: 31 },
    { number: 77, name: 'Al-Mursalat', englishName: 'Al-Mursalat', englishNameTranslation: 'The Emissaries', revelationType: 'Meccan', numberOfAyahs: 50 },
    { number: 78, name: 'An-Naba', englishName: 'An-Naba', englishNameTranslation: 'The Tidings', revelationType: 'Meccan', numberOfAyahs: 40 },
    { number: 79, name: 'An-Nazi\'at', englishName: 'An-Nazi\'at', englishNameTranslation: 'Those Who Drag Forth', revelationType: 'Meccan', numberOfAyahs: 46 },
    { number: 80, name: '\'Abasa', englishName: '\'Abasa', englishNameTranslation: 'He Frowned', revelationType: 'Meccan', numberOfAyahs: 42 },
    { number: 81, name: 'At-Takwir', englishName: 'At-Takwir', englishNameTranslation: 'The Overthrowing', revelationType: 'Meccan', numberOfAyahs: 29 },
    { number: 82, name: 'Al-Infitar', englishName: 'Al-Infitar', englishNameTranslation: 'The Cleaving', revelationType: 'Meccan', numberOfAyahs: 19 },
    { number: 83, name: 'Al-Mutaffifin', englishName: 'Al-Mutaffifin', englishNameTranslation: 'The Defrauding', revelationType: 'Meccan', numberOfAyahs: 36 },
    { number: 84, name: 'Al-Inshiqaq', englishName: 'Al-Inshiqaq', englishNameTranslation: 'The Sundering', revelationType: 'Meccan', numberOfAyahs: 25 },
    { number: 85, name: 'Al-Buruj', englishName: 'Al-Buruj', englishNameTranslation: 'The Mansions of Stars', revelationType: 'Meccan', numberOfAyahs: 22 },
    { number: 86, name: 'At-Tariq', englishName: 'At-Tariq', englishNameTranslation: 'The Morning Star', revelationType: 'Meccan', numberOfAyahs: 17 },
    { number: 87, name: 'Al-A\'la', englishName: 'Al-A\'la', englishNameTranslation: 'The Most High', revelationType: 'Meccan', numberOfAyahs: 19 },
    { number: 88, name: 'Al-Ghashiyah', englishName: 'Al-Ghashiyah', englishNameTranslation: 'The Overwhelming', revelationType: 'Meccan', numberOfAyahs: 26 },
    { number: 89, name: 'Al-Fajr', englishName: 'Al-Fajr', englishNameTranslation: 'The Dawn', revelationType: 'Meccan', numberOfAyahs: 30 },
    { number: 90, name: 'Al-Balad', englishName: 'Al-Balad', englishNameTranslation: 'The City', revelationType: 'Meccan', numberOfAyahs: 20 },
    { number: 91, name: 'Ash-Shams', englishName: 'Ash-Shams', englishNameTranslation: 'The Sun', revelationType: 'Meccan', numberOfAyahs: 15 },
    { number: 92, name: 'Al-Layl', englishName: 'Al-Layl', englishNameTranslation: 'The Night', revelationType: 'Meccan', numberOfAyahs: 21 },
    { number: 93, name: 'Ad-Duhaa', englishName: 'Ad-Duhaa', englishNameTranslation: 'The Morning Hours', revelationType: 'Meccan', numberOfAyahs: 11 },
    { number: 94, name: 'Ash-Sharh', englishName: 'Ash-Sharh', englishNameTranslation: 'The Relief', revelationType: 'Meccan', numberOfAyahs: 8 },
    { number: 95, name: 'At-Tin', englishName: 'At-Tin', englishNameTranslation: 'The Fig', revelationType: 'Meccan', numberOfAyahs: 8 },
    { number: 96, name: 'Al-\'Alaq', englishName: 'Al-\'Alaq', englishNameTranslation: 'The Clot', revelationType: 'Meccan', numberOfAyahs: 19 },
    { number: 97, name: 'Al-Qadr', englishName: 'Al-Qadr', englishNameTranslation: 'The Power', revelationType: 'Meccan', numberOfAyahs: 5 },
    { number: 98, name: 'Al-Bayyinah', englishName: 'Al-Bayyinah', englishNameTranslation: 'The Clear Proof', revelationType: 'Madinan', numberOfAyahs: 8 },
    { number: 99, name: 'Az-Zalzalah', englishName: 'Az-Zalzalah', englishNameTranslation: 'The Earthquake', revelationType: 'Madinan', numberOfAyahs: 8 },
    { number: 100, name: 'Al-\'Adiyat', englishName: 'Al-\'Adiyat', englishNameTranslation: 'The Courser', revelationType: 'Meccan', numberOfAyahs: 11 },
    { number: 101, name: 'Al-Qari\'ah', englishName: 'Al-Qari\'ah', englishNameTranslation: 'The Calamity', revelationType: 'Meccan', numberOfAyahs: 11 },
    { number: 102, name: 'At-Takathur', englishName: 'At-Takathur', englishNameTranslation: 'The Rivalry', revelationType: 'Meccan', numberOfAyahs: 8 },
    { number: 103, name: 'Al-\'Asr', englishName: 'Al-\'Asr', englishNameTranslation: 'The Declining Day', revelationType: 'Meccan', numberOfAyahs: 3 },
    { number: 104, name: 'Al-Humazah', englishName: 'Al-Humazah', englishNameTranslation: 'The Traducer', revelationType: 'Meccan', numberOfAyahs: 9 },
    { number: 105, name: 'Al-Fil', englishName: 'Al-Fil', englishNameTranslation: 'The Elephant', revelationType: 'Meccan', numberOfAyahs: 5 },
    { number: 106, name: 'Quraysh', englishName: 'Quraysh', englishNameTranslation: 'Quraysh', revelationType: 'Meccan', numberOfAyahs: 4 },
    { number: 107, name: 'Al-Ma\'un', englishName: 'Al-Ma\'un', englishNameTranslation: 'The Small Kindnesses', revelationType: 'Meccan', numberOfAyahs: 7 },
    { number: 108, name: 'Al-Kawthar', englishName: 'Al-Kawthar', englishNameTranslation: 'The Abundance', revelationType: 'Meccan', numberOfAyahs: 3 },
    { number: 109, name: 'Al-Kafirun', englishName: 'Al-Kafirun', englishNameTranslation: 'The Disbelievers', revelationType: 'Meccan', numberOfAyahs: 6 },
    { number: 110, name: 'An-Nasr', englishName: 'An-Nasr', englishNameTranslation: 'The Divine Support', revelationType: 'Madinan', numberOfAyahs: 3 },
    { number: 111, name: 'Al-Masad', englishName: 'Al-Masad', englishNameTranslation: 'The Palm Fiber', revelationType: 'Meccan', numberOfAyahs: 5 },
    { number: 112, name: 'Al-Ikhlas', englishName: 'Al-Ikhlas', englishNameTranslation: 'The Sincerity', revelationType: 'Meccan', numberOfAyahs: 4 },
    { number: 113, name: 'Al-Falaq', englishName: 'Al-Falaq', englishNameTranslation: 'The Daybreak', revelationType: 'Meccan', numberOfAyahs: 5 },
    { number: 114, name: 'An-Nas', englishName: 'An-Nas', englishNameTranslation: 'Mankind', revelationType: 'Meccan', numberOfAyahs: 6 },
  ];
}

// --- State ---
let _currentLang = 'en';
function getCurrentLang() { return _currentLang; }
function setCurrentLang(l) { _currentLang = l; }

// Export all
window.QuranAPI = {
  fetchSurahList,
  fetchSurahFull,
  fetchAyahTafsir,
  fetchSurahTafsir,
  searchQuran,
  buildAudioUrl,
  getReciterInfo,
  getReciters,
  getOfflineSurahList,
  getCurrentLang,
  setCurrentLang,
  getTranslationEdition,
  cleanHtml,
};
