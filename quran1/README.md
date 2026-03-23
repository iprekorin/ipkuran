# Quran Studio

A fully functional, production-ready Quran reading and listening web application built with pure HTML, CSS, and JavaScript. No backend required — all data is fetched from the Al-Quran Cloud API with offline fallbacks.

## Features

### Core Features
- **Quran Reading** — Full 114 Surah structure with clean Uthmanic-style Arabic text
- **Audio Listening** — Per-Ayah audio from Islamic Network CDN, with Play/Pause/Next/Previous controls
- **Multiple Reciters** — 9 reciters including Mishary Rashid Alafasy, Abdul Rahman Al Sudais, Maher Al Muaiqly, and more
- **Translations** — 13 languages: English, French, Russian, Urdu, Indonesian, Arabic, Turkish, German, Spanish, Persian, Malay, Bengali, Hindi
- **Toggle Translation** — Show/hide translations per Ayah

### Search & Navigation
- **Full-Text Search** — Search Surah names and Ayah content via API
- **Keyboard Shortcuts** — Ctrl+K to open search, Alt+Arrow for navigation, Space for play/pause
- **Hash Routing** — Clean URLs (#/surah/2, #/bookmarks, #/juzz/1)
- **Surah Filter** — Fast sidebar filtering

### Extra Features
- **Bookmarks** — Star favorite Ayahs, stored in localStorage
- **Daily Ayah** — Date-based daily reflection widget with 24h caching
- **Dark/Light Theme** — Toggle with localStorage persistence
- **Reading Progress** — Shows current position per Surah
- **Last Read** — Remembers last read position
- **Reading History** — Tracks recently visited Surahs

### SEO & PWA
- **Semantic HTML** — Proper header, main, section, article, nav, aside tags
- **Meta Tags** — Title, description, keywords, Open Graph, Twitter Cards
- **Structured Data** — JSON-LD WebApplication schema
- **Sitemap.xml** — Full sitemap with priority hints for all 114 Surahs
- **robots.txt** — Clean crawl rules
- **PWA Manifest** — Installable as a native app
- **Service Worker** — Offline caching of static assets and API responses
- **Hash Routing** — Deep-linkable Surah and Ayah URLs

### Technical
- **Modular JS** — api.js, storage.js, ui.js, audio.js, search.js, main.js
- **LocalStorage** — Theme, language, bookmarks, last read, preferences
- **Responsive** — Mobile-first design with touch-friendly controls
- **Performance** — CSS variables, lazy rendering, minimal dependencies
- **Accessibility** — ARIA labels, keyboard navigation, semantic structure

## Project Structure

```
quran-studio/
├── index.html              # Main entry with semantic HTML, meta, SEO
├── manifest.json           # PWA manifest for installability
├── sw.js                   # Service worker for offline caching
├── sitemap.xml             # Full sitemap (114 Surahs + pages)
├── robots.txt              # Crawl rules
└── assets/
    ├── css/
    │   └── styles.css      # Complete design system (dark/light, responsive)
    └── js/
        ├── api.js          # Al-Quran Cloud API integration
        ├── storage.js      # LocalStorage management
        ├── ui.js           # DOM rendering functions
        ├── audio.js        # Audio playback management
        ├── search.js       # Full Quran search
        └── main.js         # Application orchestrator
```

## How to Run

### Option 1: Direct File (limited — API needs a server)
```bash
# Open index.html directly in a browser
# Note: API calls may be blocked by CORS if opened as file://
```

### Option 2: Local Server (recommended)
```bash
# Node.js
npx http-server -p 3000 -c-1

# Python
python -m http.server 3000

# Then open: http://localhost:3000/
```

### Option 3: Deploy
- **GitHub Pages** — Push and enable Pages in repo settings
- **Netlify / Vercel** — Drag-and-drop deployment
- **Any static host** — Upload all files, works out of the box

## API Sources

| Source | Endpoint | Purpose |
|--------|----------|---------|
| Al-Quran Cloud | `api.alquran.cloud` | Surah list, Ayahs, translations, tafsir |
| Islamic Network | `cdn.islamic.network` | Per-Ayah audio (MP3) |
| Google Fonts | `fonts.googleapis.com` | Amiri, Inter, Noto Naskh Arabic |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open search |
| `Esc` | Close search |
| `Alt+→` | Next Ayah |
| `Alt+←` | Previous Ayah |
| `Alt+Space` | Play/Pause audio |
| `/` | Focus search (when on Surah page) |

## Extending the App

### Adding a new translation
Edit `api.js` — the `getLangCode()` function maps language codes. The API accepts `language_code` in the endpoint: `/surah/{n}/{language_code}`.

### Adding a new reciter
Edit the `<select id="reciterSelect">` in `index.html` and the reciter identifiers in `api.js` (`AUDIO_BASE` URL pattern).

### Adding Tafsir per Ayah
The API supports `/tafsir/{surah}/{ayah}` — `fetchTafsir()` in `api.js` is already wired. Enable the Tafsir toggle in the Surah header to display per-Ayah explanations.

### Monetization
- Add Google AdSense or similar script to `index.html` (injected in a dedicated `<div id="ads">`)
- For premium features, gate additional reciters or tafsir behind a subscription flag in `storage.js`

### Admin Dashboard
Not included in the frontend — consider:
- Google Analytics 4 for visitor tracking
- Cloudflare Workers + KV for a lightweight backend API
- Vercel Analytics or similar for performance monitoring

## License

MIT — Free to use, modify, and distribute. May Allah accept this effort.
