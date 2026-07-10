<div align="center">

# 🎵 Suno Downloader

**Tampermonkey userscript for [suno.com](https://suno.com)**

[![Version](https://img.shields.io/badge/version-9.1.0-blue?style=flat-square)](suno_downloader1.js)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-00485B?style=flat-square&logo=tampermonkey)](https://www.tampermonkey.net/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

Multi-account OAuth automation · Batch MP3/WAV download · Full ID3v2 tagging · Lyrics injection

</div>

---

## What it does

A floating widget on suno.com that handles:

- **Multi-account login** — stores Google/Microsoft OAuth accounts, auto-navigates the full login flow (account chooser → password → consent), then chains to the next account automatically
- **Batch download** — fetches the last N tracks per account as MP3 or WAV, waits for in-progress generations to finish, embeds metadata into every file
- **Full ID3v2 tagging** — 20+ frames written into every MP3: artist, album, year/month (auto-updated), genre, mood, lyrics, comment, BPM, URLs, ISRC, and more
- **Lyrics injection** — fills the Suno create form with lyrics + styles on login; uses a 3-tier approach to handle Suno's Lexical rich-text editor
- **Spam engine** — fires song generation requests in configurable burst waves with cooldowns and auto-starts on fresh credits; two independent A/B profiles
- **Tags tab** — edit all ID3 fields directly in the widget UI, no code touching needed

---

## Screenshots

| Main | Templates | Tags |
|------|-----------|------|
| ![Main](screenshots/main.png) | ![Templates](screenshots/templates.png) | ![Tags](screenshots/tags.png) |

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Open dashboard → **Create a new script**
3. Paste the contents of [`suno_downloader1.js`](suno_downloader1.js) and save
4. Open [suno.com](https://suno.com) — widget appears bottom-right

> When prompted, allow the `@connect *` permission for audio downloads.

---

## Account setup

Each account stores: provider (Google/Microsoft), email, password, download format (mp3/wav), lyrics, styles, voice preference, song name, and an auto-fill toggle.

The email must match exactly what appears on the OAuth account chooser screen.

---

## ID3 tags

All tags are editable in the **Tags tab**. Year and month auto-update to the current date on every session — enable "Lock year/month" to freeze them.

Supported frames: `TIT2 TPE1 TPE2 TCOM TEXT TPE3 TPE4 TALB TPOS TYER TDRC TORY TCON TMOO TCOP TPUB TENC TSSE TSRC COMM USLT WXXX WOAR WOAS WPUB TBPM TKEY TLAN`

---

## Spam engine

Fires requests in bursts → groups → repeat, with cooldown between groups. Configure burst size, interval, bursts per group, cooldown, and total groups. Profile A/B lets you switch between two configs instantly.

Auto-starts when credits hit ≥45. Stops and advances to the next account when credits run out.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Widget missing | Tampermonkey enabled for suno.com? Try `Ctrl+Shift+Alt+R` |
| Login stuck | Hit the red **RESET** button (top-right of page); 45s watchdog timeout |
| Download fails | Re-login to refresh the auth token |
| Lyrics not injecting | Must be on `/create`; script waits up to 15s for the editor |
| Tags missing on file | WAV has no tagging — MP3 only |

---

## Privacy

No external servers. All data (accounts, tokens, settings) stays in Tampermonkey local storage only. Use **Export All** to back it up.

---

## Changelog

**v9.1.0** — Full ID3v2 tagging (20+ frames), Tags tab UI, lyrics injection rewrite for Lexical editor, track title embedding  
**v9.0.4** — Google OAuth watchdog rewrite  
**v9.0.x** — Multi-account chain login, spam engine, templates, WAV support, export/import

---

<div align="center">

MIT License · Made with ☕ and rage · **[@potatoddas](https://www.youtube.com/@potatoddas)**

</div>
