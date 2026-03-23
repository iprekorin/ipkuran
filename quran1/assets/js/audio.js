/**
 * Quran Studio — Audio Module v6
 * Uses confirmed working audio sources:
 * - Islamic Network CDN for Mishary Alafasy (verified 200)
 * - the-quran-project.github.io for reciters 1-5 (verified 200)
 */

class QuranAudioPlayer {
  constructor() {
    this.audio = null;
    this.currentSurah = null;
    this.currentAyahIndex = 0;
    this.isPlaying = false;
    this.reciterId = 'ar.alafasy';
    this.autoplay = true;
    this.ayahs = [];
    this.surahName = '';
    this._initDone = false;
    this._urlsToTry = [];
    this._urlIndex = 0;
    this._init();
  }

  _init() {
    if (this._initDone) return;
    this._initDone = true;

    this.audio = document.getElementById('quranAudio') || new Audio();
    if (!document.getElementById('quranAudio')) {
      this.audio.id = 'quranAudio';
      document.body.appendChild(this.audio);
    }
    this.audio.preload = 'none';
    this.audio.crossOrigin = 'anonymous';

    this.audio.addEventListener('ended', () => this._onEnded());
    this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.audio.addEventListener('loadedmetadata', () => this._onLoaded());
    this.audio.addEventListener('play', () => this._onPlay());
    this.audio.addEventListener('pause', () => this._onPause());
    this.audio.addEventListener('error', () => this._onError());

    document.getElementById('playerPlayPause')?.addEventListener('click', () => this.togglePlayPause());
    document.getElementById('playerPrev')?.addEventListener('click', () => this.prevAyah());
    document.getElementById('playerNext')?.addEventListener('click', () => this.nextAyah());
    document.getElementById('playerClose')?.addEventListener('click', () => this.closePlayer());

    document.getElementById('playerAutoplay')?.addEventListener('change', (e) => {
      this.autoplay = e.target.checked;
      window.QuranStorage?.saveAutoplay(this.autoplay);
    });

    document.getElementById('playerVolume')?.addEventListener('input', (e) => {
      this.audio.volume = parseFloat(e.target.value);
      window.QuranStorage?.saveVolume(e.target.value);
    });

    document.getElementById('playerProgressBar')?.addEventListener('click', (e) => {
      if (!this.audio.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.audio.currentTime = pct * this.audio.duration;
    });

    this.autoplay = window.QuranStorage?.loadAutoplay() ?? true;
    const autoplayEl = document.getElementById('playerAutoplay');
    if (autoplayEl) autoplayEl.checked = this.autoplay;

    const savedVol = window.QuranStorage?.loadVolume();
    if (savedVol !== undefined) this.audio.volume = savedVol;
    const volEl = document.getElementById('playerVolume');
    if (volEl) volEl.value = this.audio.volume;
  }

  // Reciter → Quran-Project ID mapping
  // Quran-Project uses simple numeric IDs: 1=Mishary, 2=Abu Bakr, 3=Nasser, 4=Yasser, 5=Hani
  static RECITERS = {
    'ar.alafasy':           { name: 'Mishary Rashid Alafasy',  tqpId: 1 },
    'ar.abdurrahmaansudais':{ name: 'Abu Bakr Al Shatri',       tqpId: 2 },
    'ar.mahermuaiqly':     { name: 'Nasser Al Qatami',         tqpId: 3 },
    'ar.husary':            { name: 'Yasser Al Dosari',         tqpId: 4 },
    'ar.husarymujawwad':    { name: 'Hani Ar Rifai',            tqpId: 5 },
    'ar.ahmedajamy':        { name: 'Ahmed Al Ajamy',            tqpId: null },
    'ar.minshawimujawwad':  { name: 'Al-Minshawy (Mujawwad)',   tqpId: null },
    'ar.muhammadjibreel':   { name: 'Muhammad Jibreel',         tqpId: null },
    'ar.abdulbasityouth':   { name: 'Abdul Basit Youth',         tqpId: null },
  };

  // Build all available audio URLs for a specific ayah
  _buildAudioUrls(surahNum, ayahNum, quranNum, reciterId) {
    const info = QuranAudioPlayer.RECITERS[reciterId] || QuranAudioPlayer.RECITERS['ar.alafasy'];
    const tqpId = info?.tqpId;
    const urls = [];

    // 1. Islamic Network CDN — ONLY works for Mishary Alafasy (ar.alafasy)
    if (reciterId === 'ar.alafasy' && quranNum > 0) {
      urls.push(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${quranNum}.mp3`);
    }

    // 2. the-quran-project — works for reciters 1-5
    if (tqpId) {
      urls.push(`https://the-quran-project.github.io/Quran-Audio/Data/${tqpId}/${surahNum}_${ayahNum}.mp3`);
    }

    // 3. Al-Quran Cloud hosted audio (if API provided URLs)
    // These are handled separately via the ayah.audio field

    // 4. Fallback alternate reciters (try Mishary as universal fallback)
    if (reciterId !== 'ar.alafasy' && tqpId) {
      urls.push(`https://the-quran-project.github.io/Quran-Audio/Data/1/${surahNum}_${ayahNum}.mp3`);
      urls.push(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${quranNum > 0 ? quranNum : 1}.mp3`);
    }

    return urls.filter(Boolean);
  }

  // Load Surah data
  loadSurah(surahData, ayahIndex = 0) {
    this.currentSurah = surahData;
    this.ayahs = surahData.ayahs || [];
    this.surahName = surahData.englishName || '';
    this.currentAyahIndex = ayahIndex;
    this._updateUI();
    this._resetPlayingStates();
  }

  // Play a specific ayah
  async playAyah(ayah, quranNum, surahData) {
    if (surahData) {
      this.currentSurah = surahData;
      this.ayahs = surahData.ayahs || [];
      this.surahName = surahData.englishName || '';
    }

    if (ayah) {
      const idx = this.ayahs.findIndex(a => a.number === ayah.number);
      if (idx !== -1) this.currentAyahIndex = idx;
    }

    const cachedAyah = this.ayahs[this.currentAyahIndex];
    if (!cachedAyah) return;

    const surahNum = this.currentSurah?.number || 0;
    const ayahNum = cachedAyah.number || 0;
    const absQuranNum = cachedAyah.quranNumber || 0;

    // If API provided an audio URL, use it first
    let urls = [];
    if (cachedAyah.audio && cachedAyah.audio !== '') {
      urls.push(cachedAyah.audio);
    }

    // Then add our built URLs
    const builtUrls = this._buildAudioUrls(surahNum, ayahNum, absQuranNum, this.reciterId);
    urls = [...urls, ...builtUrls.filter(u => !urls.includes(u))];

    console.log('[Audio] URLs to try:', urls);

    this._urlsToTry = urls;
    this._urlIndex = 0;
    await this._tryPlayNextUrl();
    this._showPlayer();
    this._updateUI();
    this._updatePlayingStates(this.currentAyahIndex);
  }

  async _tryPlayNextUrl() {
    if (this._urlIndex >= this._urlsToTry.length) {
      console.warn('[Audio] All URLs exhausted');
      this._markAyahError();
      return;
    }

    const url = this._urlsToTry[this._urlIndex];
    console.log(`[Audio] Trying ${this._urlIndex + 1}/${this._urlsToTry.length}:`, url);

    this.audio.src = url;
    this.audio.load();

    try {
      await this.audio.play();
      console.log('[Audio] Playing:', url);
    } catch (err) {
      console.warn('[Audio] Failed:', url, err.message);
      this._urlIndex++;
      await this._tryPlayNextUrl();
    }
  }

  _markAyahError() {
    const ayah = this.ayahs[this.currentAyahIndex];
    if (ayah) ayah.audioError = true;
    const el = document.querySelector(`.ayah-block[data-index="${this.currentAyahIndex}"]`);
    if (el) {
      const btn = el.querySelector('.ayah-audio-btn');
      if (btn) {
        btn.classList.add('audio-error');
        btn.textContent = '⚠ Unavailable';
      }
    }
  }

  togglePlayPause() {
    if (!this.audio.src) {
      if (this.ayahs.length > 0) {
        this.playAyah(this.ayahs[this.currentAyahIndex] || this.ayahs[0], null, null);
      }
      return;
    }
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  prevAyah() {
    if (this.currentAyahIndex > 0) {
      this.currentAyahIndex--;
      this.playAyah(this.ayahs[this.currentAyahIndex], null, null);
    }
  }

  nextAyah() {
    if (this.currentAyahIndex < this.ayahs.length - 1) {
      this.currentAyahIndex++;
      this.playAyah(this.ayahs[this.currentAyahIndex], null, null);
    } else {
      this._onSurahEnd();
    }
  }

  closePlayer() {
    this.audio.pause();
    this.audio.src = '';
    this._hidePlayer();
    this._resetPlayingStates();
  }

  setReciter(reciterId) {
    this.reciterId = reciterId || 'ar.alafasy';
    window.QuranStorage?.saveReciter(this.reciterId);
    if (this.ayahs.length > 0 && this.currentSurah) {
      this.playAyah(this.ayahs[this.currentAyahIndex], null, null);
    }
  }

  // --- Event Handlers ---

  _onEnded() {
    this.isPlaying = false;
    this._updatePlayBtn();
    if (this.autoplay && this.currentAyahIndex < this.ayahs.length - 1) {
      this.nextAyah();
    } else {
      this._resetPlayingStates();
      if (this.currentAyahIndex >= this.ayahs.length - 1) {
        this._onSurahEnd();
      }
    }
  }

  _onPlay() {
    this.isPlaying = true;
    this._updatePlayBtn();
  }

  _onPause() {
    this.isPlaying = false;
    this._updatePlayBtn();
  }

  _onTimeUpdate() {
    if (!this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    const fill = document.getElementById('playerProgressFill');
    const bar = document.getElementById('playerProgressBar');
    if (fill) fill.style.width = pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', Math.round(pct));
    const cur = document.getElementById('playerCurrentTime');
    if (cur) cur.textContent = this._formatTime(this.audio.currentTime);
  }

  _onLoaded() {
    const dur = document.getElementById('playerDuration');
    if (dur) dur.textContent = this._formatTime(this.audio.duration);
  }

  _onError() {
    console.warn('[Audio] Error:', this.audio.src);
    this.isPlaying = false;
    this._updatePlayBtn();
    this._urlIndex++;
    this._tryPlayNextUrl();
  }

  _onSurahEnd() {
    if (this.autoplay && this.currentSurah?.number < 114) {
      window.location.hash = `/surah/${this.currentSurah.number + 1}`;
    }
  }

  // --- UI ---

  _updateUI() {
    document.getElementById('audioPlayer')?.classList.add('visible');
    const surahEl = document.getElementById('playerSurahName');
    const ayahEl = document.getElementById('playerAyahInfo');
    if (surahEl) surahEl.textContent = this.surahName;
    if (ayahEl) ayahEl.textContent = `Ayah ${this.currentAyahIndex + 1}${this.ayahs.length ? ' of ' + this.ayahs.length : ''}`;
    this._updatePlayBtn();
  }

  _updatePlayBtn() {
    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');
    if (!playIcon || !pauseIcon) return;
    if (this.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }

  _updatePlayingStates(activeIndex) {
    document.querySelectorAll('.ayah-block').forEach((el, i) => {
      const mainBtn = el.querySelector('.ayah-audio-btn');
      const playBtn = el.querySelector('.play-ayah-btn');
      const isActive = i === activeIndex;
      el.classList.toggle('playing', isActive);

      if (mainBtn && !mainBtn.classList.contains('audio-error')) {
        mainBtn.classList.toggle('playing', isActive);
        mainBtn.textContent = isActive ? '⏸ Now playing' : '▶ Listen';
      }
      if (playBtn) {
        playBtn.textContent = isActive ? '⏸' : '▶';
        playBtn.classList.toggle('playing', isActive);
      }
    });
  }

  _resetPlayingStates() { this._updatePlayingStates(-1); }

  _showPlayer() { document.getElementById('audioPlayer')?.classList.add('visible'); }
  _hidePlayer() { document.getElementById('audioPlayer')?.classList.remove('visible'); }

  _formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  }
}

function initAudio() {
  if (!window.QuranAudio) window.QuranAudio = new QuranAudioPlayer();
}
if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(initAudio, 0);
document.addEventListener('DOMContentLoaded', initAudio);

window.QuranAudioPlayer = QuranAudioPlayer;
