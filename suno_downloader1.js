// ==UserScript==
// @name         Suno Multi-Account Downloader (Vintage Designer)
// @namespace    http://tampermonkey.net/
// @version      9.1.0
// @description  Vintage Windows 95 dark redesign – bevels, MS Sans Serif, and calm accessibility. Lexical form fix & strict credit drain.
// @author       You & Claude & Pissed-off old man
// @match        https://suno.com/*
// @match        https://accounts.google.com/*
// @match        https://login.microsoftonline.com/*
// @match        https://login.live.com/*
// @match        https://login.microsoft.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @connect      studio-api-prod.suno.com
// @connect      cdn1.suno.ai
// @connect      cdn2.suno.ai
// @connect      audiopipe.suno.ai
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/browser-id3-writer@4.4.0/dist/browser-id3-writer.min.js
// ==/UserScript==

(function () {
    'use strict';

    const H = location.hostname;
    const IS_SUNO = H.includes('suno.com');
    const IS_GOOGLE = H.includes('accounts.google.com');
    const IS_MSFT = H.includes('microsoftonline.com') || H.includes('login.live.com') || H.includes('login.microsoft.com');

    // METADATA is now dynamic — managed via the Tags tab and GM storage
    function getTagSettings() {
        try {
            const now = new Date();
            const defaults = {
                artist:         'potatoddas',
                album_artist:   'potatoddas',
                composer:       'potatoddas',
                lyricist:       'ChatGPT + Grok + Claude + Qwen',
                original_artist:'potatoddas',
                conductor:      'potatoddas',
                remixer:        'potatoddas',
                featured_artist:'ЛЫБЕЛЬ',
                album:          '',
                disc:           '',
                disc_total:     '',
                year:           String(now.getFullYear()),
                date:           String(now.getMonth() + 1).padStart(2, '0'),
                original_year:  String(now.getFullYear()),
                genre:          'Hip-hop',
                mood:           'Groovy',
                copyright:      'potatoddas',
                publisher:      'potatoddas',
                encoded_by:     'potatoddas',
                encoding_tool:  'Audacity',
                isrc:           'potatoddas',
                comment:        'russian, philosophy, beat, bassline, deep male voice, hip hop, rap, discipline, warrior mindset, studio high quality, heavy bass, Deep Sub Bass, mafia, clear natural voice, rhytm, Mafia noir, Dark philosophy, Authoritative tone, calm. Repetitive hypnotic hook, smooth but heavy bounce. Repeatable Hook, Head-Nod Rhythm. Designed for car speakers with strong sub bass and clean dynamics.',
                url:            'https://www.youtube.com/@potatoddas',
                url_artist:     'https://www.youtube.com/@potatoddas',
                url_audio_source:'https://suno.com/create',
                url_publisher:  'https://vk.com/potatoddas',
                bpm:            '90',
                key:            '',
                language:       'rus',
                title:          ''
            };
            const stored = JSON.parse(GM_getValue('snd_tag_settings', 'null'));
            if (!stored) return defaults;
            // Always refresh year/date to current month/year if they equal a past auto-set value
            if (!stored._year_locked) {
                stored.year = String(now.getFullYear());
                stored.date = String(now.getMonth() + 1).padStart(2, '0');
                stored.original_year = String(now.getFullYear());
            }
            return { ...defaults, ...stored };
        } catch (e) { return {}; }
    }
    function saveTagSettings(s) { GM_setValue('snd_tag_settings', JSON.stringify(s)); }
    // Backwards-compat shim used by the old METADATA references below
    function getMETADATA() { return getTagSettings(); }

    let capturedAuth = GM_getValue('snd_auth', null);
    let capturedBrowser = null;
    let capturedDevice = null;
    let isWorking = false;
    let isWrappingUp = false;
    let cancelRequested = false;
    let reloginInFlight = false;
    let sunoLoginWatchdogInstalled = false;
    let oauthReturnProcessed = false;
    let widgetCollapsed = GM_getValue('snd_widget_collapsed', false);
    let currentModalBackdrop = null;
    let outOfCreditsLogged = false;

    let spamState = {
        running: false, startTime: null, currentGroup: 0, currentBurstInGroup: 0,
        totalGroups: 999, burstsPerGroup: 2, burstSize: 5, burstInterval: 75,
        burstGroupInterval: 500, cooldown: 60, outOfCredits: false,
        burstTimer: null, cooldownTimer: null
    };

    function getSpamProfiles() { try { return JSON.parse(GM_getValue('snd_spam_profiles', 'null')) || {}; } catch (e) { return {}; } }
    function saveSpamProfiles(p) { GM_setValue('snd_spam_profiles', JSON.stringify(p)); }
    function getActiveProfile() { return GM_getValue('snd_spam_active_profile', 'A'); }
    function setActiveProfile(p) { GM_setValue('snd_spam_active_profile', p); }

    function getSpamSettings() {
        try {
            const profiles = getSpamProfiles();
            const active = getActiveProfile();
            if (profiles[active] && Object.keys(profiles[active]).length) return profiles[active];
            return JSON.parse(GM_getValue('snd_spam_settings', '{}'));
        } catch (e) { return {}; }
    }
    function saveSpamSettings(s) {
        GM_setValue('snd_spam_settings', JSON.stringify(s));
        const profiles = getSpamProfiles();
        const active = getActiveProfile();
        profiles[active] = s;
        saveSpamProfiles(profiles);
    }

    function exportWarriorData() {
        try {
            let data = {};
            let keys = typeof GM_listValues === 'function' ? GM_listValues() : [
                'snd_auth', 'snd_widget_collapsed', 'snd_spam_profiles', 'snd_spam_active_profile',
                'snd_spam_settings', 'snd_accounts', 'snd_auto', 'snd_templates',
                'snd_widget_pos', 'snd_auto_spam_fresh', 'snd_wait_gen', 'snd_auto_next',
                'snd_widget_opacity', 'snd_last_acc_form'
            ];

            keys.forEach(k => {
                if (k.startsWith('snd_')) {
                    let val = GM_getValue(k, null);
                    if (val !== null) data[k] = val;
                }
            });

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `suno_warrior_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
            addLog('Total system state exported flawlessly. Guard this.', '#22c55e');
        } catch (e) {
            console.error('[SND] Export blew up:', e);
            alert('Export failed. Check the console.');
        }
    }

    function importWarriorData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    let importedCount = 0;
                    for (let k in data) {
                        if (k.startsWith('snd_')) {
                            GM_setValue(k, data[k]);
                            importedCount++;
                        }
                    }
                    alert(`Reality restored. Overwrote ${importedCount} parameters. Reloading the damn page to apply the magic.`);
                    unsafeWindow.location.reload();
                } catch (err) {
                    alert('Your file is fucked. Invalid JSON.');
                    addLog('Import failed. Corrupted file.', '#ef4444');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function getAccounts() {
        try {
            const raw = JSON.parse(GM_getValue('snd_accounts', '[]'));
            return raw.map(a => ({
                ...a,
                done: Boolean(a.done),
                enabled: a.enabled !== undefined ? Boolean(a.enabled) : true,
                autoFill: Boolean(a.autoFill),
                format: a.format || 'mp3',
                password: a.password || '',
                lastEdited: a.lastEdited || null
            }));
        } catch (e) { return []; }
    }
    function saveAccounts(arr) { GM_setValue('snd_accounts', JSON.stringify(arr)); }

    function fmtLastEdited(ts) {
        if (!ts) return '';
        try {
            const d = new Date(ts);
            if (isNaN(d.getTime())) return '';
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const mon = String(d.getMonth() + 1).padStart(2, '0');
            const yr = d.getFullYear();
            return `${hh}:${mm} ${day}/${mon}/${yr}`;
        } catch (e) { return ''; }
    }

    function getAuto() { try { return JSON.parse(GM_getValue('snd_auto', '{}')); } catch (e) { return {}; } }
    function saveAuto(s) { GM_setValue('snd_auto', JSON.stringify(s)); }

    function uid() { return Math.random().toString(36).slice(2, 9); }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function parseHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function emergencyReset() {
        console.log('[SND] Yanking the cord. EMERGENCY RESET TRIGGERED.');
        try {
            const preserved = { chainEnabled: true };
            GM_setValue('snd_auto', preserved);
            reloginInFlight = false;
            oauthReturnProcessed = false;
            isWorking = false;
            isWrappingUp = false;
            cancelRequested = false;
            spamState.running = false;
            if (spamState.burstTimer) clearTimeout(spamState.burstTimer);
            if (spamState.cooldownTimer) clearTimeout(spamState.cooldownTimer);
            outOfCreditsLogged = false;
            document.getElementById('snd-overlay')?.remove();
            document.getElementById('snd-reset-btn')?.remove();
            ensureWidget();
            addLog('STATE RESET! Yanked the cord. Widget respawned. You\'re good.', '#ef4444');
            setStatus('State reset. Back to business.');
        } catch (err) {
            console.error('[SND] Reset failed. Son of a bitch:', err);
            alert('Reset failed. Reload the damn page.');
        }
    }

    function initEmergencyUI() {
        if (!IS_SUNO) return;
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                emergencyReset();
            }
        });
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('EMERGENCY RESET (Fix stuck login)', emergencyReset);
        }
        waitForBody(() => {
            const btn = document.createElement('button');
            btn.id = 'snd-reset-btn';
            btn.innerHTML = 'RESET';
            btn.title = "Stuck? Smash this to fix the state.";
            btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#7f1d1d;color:#fff;border:2px solid #fca5a5;border-radius:8px;padding:6px 8px;font-size:11px;font-weight:bold;cursor:pointer;box-shadow:0 0 10px rgba(239,68,68,0.6);transition:transform 0.2s;';
            btn.onclick = emergencyReset;
            document.documentElement.appendChild(btn);
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
        });
    }

    function initNetworkHooks() {
        if (!IS_SUNO) return;
        try {
            const _origFetch = unsafeWindow.fetch.bind(unsafeWindow);
            unsafeWindow.fetch = async function (...args) {
                const [resource, init] = args;
                const url = typeof resource === 'string' ? resource : resource instanceof unsafeWindow.Request ? resource.url : String(resource);
                if (url.includes('studio-api-prod.suno.com')) {
                    try {
                        const h = init?.headers || {};
                        let norm = {};
                        if (h instanceof unsafeWindow.Headers) h.forEach((v, k) => norm[k.toLowerCase()] = v);
                        else if (Array.isArray(h)) h.forEach(([k, v]) => norm[k.toLowerCase()] = v);
                        else Object.keys(h).forEach(k => norm[k.toLowerCase()] = h[k]);
                        if (norm['authorization']) {
                            capturedAuth = norm['authorization'];
                            capturedBrowser = norm['browser-token'] || capturedBrowser;
                            capturedDevice = norm['device-id'] || capturedDevice;
                            GM_setValue('snd_auth', capturedAuth);
                            updateDot();
                        }
                    } catch (e) { }
                }
                return _origFetch(...args);
            };
        } catch (e) { }

        try {
            const _origOpen = unsafeWindow.XMLHttpRequest.prototype.open;
            const _origSend = unsafeWindow.XMLHttpRequest.prototype.send;
            const _origSetHeader = unsafeWindow.XMLHttpRequest.prototype.setRequestHeader;
            unsafeWindow.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this._snd_url = url; this._snd_headers = {};
                return _origOpen.call(this, method, url, ...rest);
            };
            unsafeWindow.XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
                if (this._snd_url?.includes('studio-api-prod.suno.com')) this._snd_headers[key.toLowerCase()] = value;
                return _origSetHeader.call(this, key, value);
            };
            unsafeWindow.XMLHttpRequest.prototype.send = function (...args) {
                if (this._snd_url?.includes('studio-api-prod.suno.com')) {
                    const h = this._snd_headers || {};
                    if (h['authorization']) {
                        capturedAuth = h['authorization'];
                        capturedBrowser = h['browser-token'] || capturedBrowser;
                        capturedDevice = h['device-id'] || capturedDevice;
                        GM_setValue('snd_auth', capturedAuth);
                        updateDot();
                    }
                }
                return _origSend.call(this, ...args);
            };
        } catch (e) { }
    }

    function tryGrabClerkToken() {
        try {
            const ls = unsafeWindow.localStorage;
            for (const key of Object.keys(ls)) {
                const raw = ls.getItem(key);
                if (!raw || raw[0] !== '{') continue;
                let obj; try { obj = JSON.parse(raw); } catch (e) { continue; }
                const token = deepFind(obj, ['jwt', 'token', 'access_token', '__raw']);
                if (token && typeof token === 'string' && token.startsWith('eyJ') && token.length > 100) {
                    capturedAuth = 'Bearer ' + token;
                    GM_setValue('snd_auth', capturedAuth);
                    updateDot();
                    return true;
                }
            }
        } catch (e) { }
        return false;
    }

    function deepFind(obj, keys, depth = 0, visited = new WeakSet()) {
        if (!obj || typeof obj !== 'object' || depth > 5 || visited.has(obj)) return null;
        visited.add(obj);
        for (const k of Object.keys(obj)) {
            if (keys.includes(k) && typeof obj[k] === 'string') return obj[k];
            const f = deepFind(obj[k], keys, depth + 1, visited);
            if (f) return f;
        }
        return null;
    }

    function handleGoogleChooser() {
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return;
        const accounts = getAccounts();
        const acc = accounts[auto.currentIdx];
        if (!acc || acc.provider !== 'google') return;
        saveAuto({ ...auto, oauthVisited: true });
        
        const targetEmail = acc.email.toLowerCase().trim();
        let overlayShown = false;

        const isElemVisible = (el) => {
            if (!el) return false;
            try {
                const s = unsafeWindow.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null && el.offsetHeight > 0;
            } catch (e) { return false; }
        };

        const checkConsent = () => {
            const allowBtn = document.querySelector('#submit_approve_access, button[type="submit"][name="submit"]');
            if (allowBtn && !allowBtn.disabled && isElemVisible(allowBtn)) { 
                console.log('[SND] Google consent page, clicking Allow.'); 
                if (!allowBtn.dataset.sndClicked) { allowBtn.dataset.sndClicked = 'true'; allowBtn.click(); }
                return true; 
            }
            const continueBtn = Array.from(document.querySelectorAll('button')).find(b => /continue|allow/i.test(b.innerText || b.textContent) && !b.disabled && isElemVisible(b));
            if (continueBtn) {
                console.log('[SND] Google consent page, clicking Continue.');
                if (!continueBtn.dataset.sndClicked) { continueBtn.dataset.sndClicked = 'true'; continueBtn.click(); }
                return true;
            }
            return false;
        };

        const googleWatchdog = setInterval(() => {
            if (checkConsent()) {
                if (!overlayShown) { showPageOverlay(`Google: consent page, auto-allowing...`); overlayShown = true; }
                return;
            }

            const isGooglePasswordPage = !!(document.querySelector('input[type="password"]') || document.querySelector('[data-page-id="passwordEntry"]') || /\/pwd|\/challenge\/pwd|passwordEntry/i.test(location.pathname + location.search));
            
            if (isGooglePasswordPage) {
                const pwdEl = document.querySelector('input[type="password"]');
                if (pwdEl && isElemVisible(pwdEl)) {
                    if (acc.password) {
                        if (!pwdEl.dataset.sndFilled) {
                            console.log("[Google-Login] Slapping the password in there.");
                            pwdEl.dataset.sndFilled = "true";
                            setNativeValue(pwdEl, acc.password);
                            setTimeout(() => {
                                const nextBtn = document.querySelector('#passwordNext, button[type="submit"], [jsname="LgbsSe"], #submit');
                                if (nextBtn && isElemVisible(nextBtn)) nextBtn.click();
                            }, 600);
                        }
                    } else {
                        if (!pwdEl.dataset.sndNotified) {
                            pwdEl.dataset.sndNotified = "true";
                            showPageOverlay(`Google needs a password for:\n${acc.email}\n\nEnter the damn thing. I'll pick up from there.`);
                        }
                    }
                }
                return;
            }

            const emailInput = document.querySelector('input[type="email"], input[name="identifier"]');
            if (emailInput && isElemVisible(emailInput) && !document.querySelector('div[data-identifier]')) {
                if (!emailInput.dataset.sndFilled) {
                    emailInput.dataset.sndFilled = "true";
                    setNativeValue(emailInput, acc.email);
                    setTimeout(() => {
                        const nextBtn = document.querySelector('button[type="submit"], #identifierNext, [jsname="NHy15c"]');
                        if (nextBtn && isElemVisible(nextBtn)) nextBtn.click();
                    }, 800);
                }
                return;
            }

            const searchStr = targetEmail;
            const elements = document.querySelectorAll('div[role="link"], div[role="button"], button, div[data-email], div[data-identifier], li, div[data-authuser]');
            let tile = null;
            for (const el of elements) {
                if (!isElemVisible(el)) continue;
                const text = (el.textContent || '').toLowerCase().trim();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase().trim();
                const dEmail = (el.getAttribute('data-email') || '').toLowerCase().trim();
                const dId = (el.getAttribute('data-identifier') || '').toLowerCase().trim();
                if (text === searchStr || aria.includes(searchStr) || dEmail === searchStr || dId === searchStr || text.includes(searchStr)) {
                    tile = el.closest('div[role="link"], div[role="button"], button, li') || el;
                    break;
                }
            }

            if (tile) {
                if (!tile.dataset.sndClicked) {
                    console.log("[Google-Login] Clicking account tile.");
                    tile.dataset.sndClicked = 'true';
                    if (!overlayShown) { showPageOverlay(`Grabbing Google account:\n${acc.email}`); overlayShown = true; }
                    tile.click();
                }
                return;
            }

            const other = document.querySelector('div[role="link"] div.riDSKb') || [...document.querySelectorAll('div[role="link"], div[role="button"], li')].find(el => /use another account|add account|another account/i.test(el.textContent || '') && isElemVisible(el));
            if (other) {
                if (!other.dataset.sndClicked) {
                    console.log("[Google-Login] Clicking 'Use another account'.");
                    other.dataset.sndClicked = 'true';
                    other.click();
                }
            }

        }, 500);

        setTimeout(() => clearInterval(googleWatchdog), 45000);
    }

    function handleMicrosoftLogin() {
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return;
        const accounts = getAccounts();
        const acc = accounts[auto.currentIdx];
        if (!acc || acc.provider !== 'microsoft') return;
        saveAuto({ ...auto, oauthVisited: true });
        if (enforceCurrentMicrosoftPrompt()) return;

        const targetEmail = acc.email.toLowerCase().trim();
        let overlayShown = false;

        const isElemVisible = (el) => {
            if (!el) return false;
            try {
                const s = unsafeWindow.getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null && el.offsetHeight > 0;
            } catch (e) { return false; }
        };

        const msWatchdog = setInterval(() => {
            const fidoSignInAnotherWay = document.querySelector('#idA_PWD_SwitchToCredPicker');
            if (fidoSignInAnotherWay && isElemVisible(fidoSignInAnotherWay)) {
                console.log('[MS-Login] FIDO/passkey acting up — slapping "Sign in another way".');
                if (!fidoSignInAnotherWay.dataset.sndClicked) {
                    fidoSignInAnotherWay.dataset.sndClicked = 'true';
                    fidoSignInAnotherWay.click();
                }
                return;
            }

            const credPickerTitle = document.querySelector('h1, h2, .text-title, [data-testid*="title"]');
            const isCredPicker = credPickerTitle && /sign in another way/i.test(credPickerTitle.innerText || '');
            if (isCredPicker) {
                const pwdTile = document.querySelector('div[role="group"][aria-label="Use your password" i]');
                const pwdTileBtn = pwdTile ? (pwdTile.querySelector('span[role="button"]') || pwdTile) : null;
                const pwdFallback = !pwdTileBtn && Array.from(document.querySelectorAll('span[role="button"], div[role="button"], button, a')).find(el => /use your password/i.test(el.innerText || el.textContent || ''));
                const target = pwdTileBtn || pwdFallback;
                if (target && isElemVisible(target)) {
                    console.log('[MS-Login] "Sign in another way" picker — clicking "Use your password".');
                    if (!target.dataset.sndClicked) {
                        target.dataset.sndClicked = 'true';
                        target.click();
                    }
                    return;
                }
                return;
            }

            const verifyTitle = document.querySelector('h1, .text-title, [data-testid*="title"]');
            const isVerifyEmailScreen = verifyTitle && /verify your email/i.test(verifyTitle.innerText || '');
            if (isVerifyEmailScreen) {
                const usePwdBtn = (
                    document.querySelector('#view > div > span:nth-child(6) > div > span') ||
                    document.querySelector('span[role="button"][tabindex="0"]') ||
                    Array.from(document.querySelectorAll('span[role="button"], a[role="button"], button, a'))
                        .find(el => /use your password/i.test(el.innerText || el.textContent))
                );
                if (usePwdBtn && isElemVisible(usePwdBtn)) {
                    console.log('[MS-Login] "Verify your email" wall — clicking "Use your password" to skip that bullshit.');
                    if (!usePwdBtn.dataset.sndClicked) {
                        usePwdBtn.dataset.sndClicked = 'true';
                        usePwdBtn.click();
                    }
                    return;
                }
                return;
            }

            const kmsiTitleEl = document.querySelector('h1') || document.querySelector('.text-title') || document.querySelector('[data-testid*="title"]');
            const isKMSIPage = kmsiTitleEl && /stay signed in/i.test(kmsiTitleEl.innerText || '');
            const primaryBtn = document.querySelector('button[data-testid="primaryButton"]');
            if (isKMSIPage && primaryBtn && isElemVisible(primaryBtn)) {
                console.log("[MS-Login] 'Stay signed in?' (new UI) — clicking Yes.");
                if (!primaryBtn.dataset.sndClicked) {
                    primaryBtn.dataset.sndClicked = 'true';
                    primaryBtn.click();
                }
                return;
            }

            const btnYes = document.querySelector('#idSIButton9');
            const kmsiCheckbox = document.querySelector('#KmsiCheckboxField');
            const declineButton = document.querySelector('#idBtn_Back');
            if (btnYes && isElemVisible(btnYes)) {
                const isKMSI = isKMSIPage || (kmsiCheckbox && isElemVisible(kmsiCheckbox)) || (declineButton && isElemVisible(declineButton));
                if (isKMSI) {
                    console.log("[MS-Login] 'Stay signed in?' (old UI) — clicking YES.");
                    if (kmsiCheckbox && !kmsiCheckbox.checked) kmsiCheckbox.click();
                    btnYes.click();
                    return;
                }
            }

            const pwdSwitch = document.querySelector('#idA_PWD_SwitchToPassword, #signInAnotherWay, a[data-bind*="switchToPassword"]');
            if (pwdSwitch && isElemVisible(pwdSwitch)) {
                console.log("[MS-Login] Forcing password mode over authenticator app.");
                pwdSwitch.click();
                return;
            }

            const pwdEl = document.querySelector('input[type="password"], input[name="passwd"], input[name="password"], #i0118');
            if (pwdEl && isElemVisible(pwdEl)) {
                if (acc.password) {
                    if (!pwdEl.dataset.sndFilled) {
                        console.log("[MS-Login] Slapping the password in there.");
                        pwdEl.dataset.sndFilled = "true";
                        setNativeValue(pwdEl, acc.password);
                        setTimeout(() => {
                            const nextBtn = document.querySelector('#idSIButton9, input[type="submit"], button[type="submit"]');
                            if (nextBtn && isElemVisible(nextBtn)) nextBtn.click();
                        }, 600);
                    }
                } else {
                    if (!overlayShown) {
                        showPageOverlay(`Enter Microsoft password for:\n${acc.email}\n\nEnter the damn password, then click "Yes" when it asks to stay signed in.`);
                        overlayShown = true;
                    }
                }
                return;
            }

            const chooseTitle = document.querySelector('h1, h2, .text-title');
            const isChooseScreen = chooseTitle && /choose an account/i.test(chooseTitle.innerText || '');
            if (isChooseScreen) {
                const allBtns = document.querySelectorAll('span[role="button"], div[role="button"]');
                for (const btn of allBtns) {
                    const txt = (btn.innerText || btn.textContent || '').toLowerCase().trim();
                    if (txt === targetEmail && isElemVisible(btn)) {
                        console.log('[MS-Login] "Choose an account" — clicking exact email button:', targetEmail);
                        if (!btn.dataset.sndClicked) { btn.dataset.sndClicked = 'true'; btn.click(); }
                        return;
                    }
                }
                const tiles = document.querySelectorAll('div[data-testid="tile"], .fui-Card, [class*="tile"], [class*="account-item"]');
                for (const tile of tiles) {
                    const txt = (tile.innerText || tile.textContent || '').toLowerCase();
                    if (txt.includes(targetEmail) && isElemVisible(tile)) {
                        console.log('[MS-Login] "Choose an account" — clicking tile card for:', targetEmail);
                        if (!tile.dataset.sndClicked) { tile.dataset.sndClicked = 'true'; tile.click(); }
                        return;
                    }
                }
                const legacyTiles = document.querySelectorAll('div[data-test-id], .row, .table-cell');
                for (const tile of legacyTiles) {
                    const txt = (tile.innerText || '').toLowerCase();
                    if (txt.includes(targetEmail) && isElemVisible(tile)) {
                        console.log('[MS-Login] "Choose an account" (legacy UI) — clicking tile for:', targetEmail);
                        if (!tile.dataset.sndClicked) { tile.dataset.sndClicked = 'true'; tile.click(); }
                        return;
                    }
                }
                return;
            }

            const emailInput = document.querySelector('input[type="email"], input[name="loginfmt"], input[name="login"], input#i0116');
            if (emailInput && isElemVisible(emailInput)) {
                if (!overlayShown) { showPageOverlay(`Selecting Microsoft account:\n${acc.email}`); overlayShown = true; }
                if (!emailInput.dataset.sndFilled) {
                    emailInput.dataset.sndFilled = "true";
                    setNativeValue(emailInput, acc.email);
                    setTimeout(() => {
                        const nextBtn = document.querySelector('#idSIButton9, input[type="submit"], button[type="submit"]');
                        if (nextBtn && isElemVisible(nextBtn)) nextBtn.click();
                    }, 500);
                }
                return;
            }

            const otherLink = document.querySelector('#otherTile, [aria-label*="other account" i], [aria-label*="another account" i]');
            if (otherLink && isElemVisible(otherLink)) otherLink.click();
        }, 1000);
    }

    function isMicrosoftAutoLogin() {
        const auto = getAuto(); const acc = getCurrentAccount();
        return !!((auto.active || auto.pendingLogin) && acc?.provider === 'microsoft');
    }
    function isMicrosoftOAuthUrl(rawUrl) {
        try {
            const u = new URL(rawUrl, location.href);
            const host = u.hostname.toLowerCase();
            if (!host.includes('login.microsoftonline.com') && !host.includes('login.live.com')) return false;
            const path = u.pathname.toLowerCase();
            if (path.includes('/oauth2/') || path.includes('oauth20_authorize')) return true;
            return u.searchParams.has('client_id') && u.searchParams.has('redirect_uri') && (u.searchParams.has('response_type') || u.searchParams.has('scope'));
        } catch (e) { return false; }
    }
    function withMicrosoftSelectAccount(rawUrl) {
        try {
            const u = new URL(rawUrl, location.href);
            if (!isMicrosoftOAuthUrl(u.href)) return rawUrl;
            if (u.searchParams.get('prompt') === 'select_account') return rawUrl;
            u.searchParams.set('prompt', 'select_account');
            return u.href;
        } catch (e) { return rawUrl; }
    }
    function enforceCurrentMicrosoftPrompt() {
        if (!IS_MSFT || !isMicrosoftAutoLogin() || !isMicrosoftOAuthUrl(location.href)) return false;
        const forced = withMicrosoftSelectAccount(location.href);
        if (forced !== location.href) { console.log('[SND] forcing Microsoft prompt=select_account'); unsafeWindow.location.replace(forced); return true; }
        return false;
    }
    function installMicrosoftOAuthPromptHook() {
        if (!IS_SUNO && !IS_MSFT) return;
        if (!isMicrosoftAutoLogin()) return;
        try {
            const origOpen = unsafeWindow.open;
            unsafeWindow.open = function (url, ...rest) { if (typeof url === 'string') url = withMicrosoftSelectAccount(url); return origOpen.call(this, url, ...rest); };
        } catch (e) { }
        try {
            const locProto = unsafeWindow.Location?.prototype;
            if (locProto?.assign) { const origAssign = locProto.assign; locProto.assign = function (url) { return origAssign.call(this, withMicrosoftSelectAccount(url)); }; }
            if (locProto?.replace) { const origReplace = locProto.replace; locProto.replace = function (url) { return origReplace.call(this, withMicrosoftSelectAccount(url)); }; }
        } catch (e) { }
        const rewriteLinksAndForms = () => {
            try {
                document.querySelectorAll('a[href]').forEach(a => { const forced = withMicrosoftSelectAccount(a.href); if (forced !== a.href) a.href = forced; });
                document.querySelectorAll('form[action]').forEach(f => { const forced = withMicrosoftSelectAccount(f.action); if (forced !== f.action) f.action = forced; });
            } catch (e) { }
        };
        document.addEventListener('click', e => { const a = e.target?.closest?.('a[href]'); if (!a) return; const forced = withMicrosoftSelectAccount(a.href); if (forced !== a.href) a.href = forced; }, true);
        if (document.documentElement) { const obs = new MutationObserver(rewriteLinksAndForms); obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'action'] }); }
        rewriteLinksAndForms();
    }

    if ((IS_MSFT || IS_GOOGLE) && getAuto().currentIdx !== undefined) {
        const auto = getAuto();
        if (auto.active || auto.pendingLogin) saveAuto({ ...auto, oauthVisited: true });
    }
    installMicrosoftOAuthPromptHook();
    if (enforceCurrentMicrosoftPrompt()) return;

    function handleSunoSignin() {
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return;
        const accounts = getAccounts();
        const acc = accounts[auto.currentIdx];
        if (!acc) return;
        showPageOverlay(`Logging in as: ${acc.name || acc.email}\nSit tight.`);
        const tryClick = () => {
            const btns = [...document.querySelectorAll('button, a, [role="button"]')];
            const markProviderStart = () => { const cur = getAuto(); saveAuto({ ...cur, step: 'login_pending', providerClickedAt: Date.now(), oauthVisited: false }); installSunoLoginWatchdog(); };
            if (acc.provider === 'google') { const btn = btns.find(b => /google/i.test(b.textContent)); if (btn) { markProviderStart(); btn.click(); return true; } }
            if (acc.provider === 'microsoft') { const btn = btns.find(b => /microsoft|outlook|hotmail/i.test(b.textContent)); if (btn) { markProviderStart(); btn.click(); return true; } }
            return false;
        };
        saveAuto({ ...auto, step: 'login_pending', oauthVisited: false });
        [1000, 2500, 4000, 6000].forEach(t => setTimeout(tryClick, t));
    }

    function setNativeValue(el, value) {
        try {
            const proto = el.tagName === 'TEXTAREA' ? unsafeWindow.HTMLTextAreaElement.prototype : unsafeWindow.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
            setter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (e) {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
    }

    function isInsideSearchOrHeader(el) { return !!(el.closest('header, nav, [role="banner"], [role="search"], form[role="search"], .search, .explore, .sidebar')); }

    async function waitForCreateForm() {
        const start = Date.now();
        while (Date.now() - start < 15000) {
            // Suno uses a Lexical contenteditable div — multiple possible selectors
            const lexical = document.querySelector(
                'div[data-lexical-editor="true"], div[aria-label="Lyrics editor"], ' +
                'div[aria-label*="lyric" i][contenteditable="true"], div[contenteditable="true"][data-testid*="lyric" i], ' +
                'div.ProseMirror[contenteditable="true"], div[class*="lyric"][contenteditable="true"]'
            );
            if (lexical && !isInsideSearchOrHeader(lexical)) return lexical;

            const lyricArea = document.querySelector('textarea[data-testid="lyrics-textarea"]');
            if (lyricArea && !isInsideSearchOrHeader(lyricArea)) return lyricArea;

            const legacy = document.querySelector('textarea[placeholder*="lyric" i], textarea[placeholder*="lyrics" i]');
            if (legacy && !isInsideSearchOrHeader(legacy)) return legacy;

            await sleep(300);
        }
        return null;
    }

    async function injectTextIntoLexical(el, text) {
        // Try clipboard-based paste first — most reliable for Lexical/ProseMirror
        if (el.isContentEditable) {
            el.focus();
            await sleep(50);
            // Select all existing content first
            const sel = unsafeWindow.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
            await sleep(30);
            // Try clipboard API approach via DataTransfer
            try {
                const dt = new DataTransfer();
                dt.setData('text/plain', text);
                el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
                await sleep(80);
                const check = el.innerText || el.textContent || '';
                if (check.trim().length > 0) return true;
            } catch (e) { /* fall through */ }
            // execCommand fallback (deprecated but still works in Tampermonkey context)
            try {
                document.execCommand('selectAll', false, null);
                const ok = document.execCommand('insertText', false, text);
                if (ok) {
                    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
                    await sleep(80);
                    const check2 = el.innerText || el.textContent || '';
                    if (check2.trim().length > 0) return true;
                }
            } catch (e2) { /* fall through */ }
            // Last resort: directly manipulate innerText and fire synthetic events
            el.innerText = text;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return (el.innerText || '').trim().length > 0;
        } else {
            setNativeValue(el, text);
            return (el.value || '').trim().length > 0;
        }
    }

    function findStylesField() {
        const wrapper = document.querySelector('[data-testid="create-form-styles-wrapper"]');
        if (wrapper) {
            const ta = wrapper.querySelector('textarea');
            if (ta && !isInsideSearchOrHeader(ta)) return ta;
        }

        const stylesByTestId = document.querySelector('textarea[data-testid="styles-textarea"]');
        if (stylesByTestId && !isInsideSearchOrHeader(stylesByTestId)) return stylesByTestId;

        const lyricsField = document.querySelector('textarea[data-testid="lyrics-textarea"]');
        if (lyricsField) {
            const formSection = lyricsField.closest('form, [role="form"], .css-1o3f9sc');
            if (formSection) {
                const allTA = [...formSection.querySelectorAll('textarea')].filter(ta => !isInsideSearchOrHeader(ta));
                const stylesTA = allTA.find(ta => ta !== lyricsField);
                if (stylesTA) return stylesTA;
            }
        }

        const allTA = [...document.querySelectorAll('textarea')].filter(ta => !isInsideSearchOrHeader(ta));
        const lyricsTA = allTA.find(ta => /lyric|lyrics/i.test(ta.placeholder || '') || ta.dataset.testid === 'lyrics-textarea');
        const stylesTA = allTA.find(ta => ta !== lyricsTA && (/style|music|genre|describe/i.test(ta.placeholder || '') || ta.dataset.testid === 'styles-textarea'));
        if (stylesTA) return stylesTA;

        if (allTA.length === 2) return allTA[1];
        return null;
    }

    async function fillSunoForm(acc, retries = 3) {
        if (!acc.lyrics && !acc.styles && !acc.voice && !acc.songName) return true;
        if (!isSunoCreatePath()) {
            console.warn('[SND] Not on /create page. Refusing to fill this garbage:', location.href);
            return false;
        }

        ensureWidget();
        addLog(retries === 3 ? 'Filling create form...' : 'Smacking the form again...', '#d4a574');

        await sleep(800);

        const lyricElement = await waitForCreateForm();
        if (!lyricElement) {
            addLog('Create form MIA. Reload the damn page.', '#ef4444');
            return false;
        }

        if (acc.lyrics) {
            const ok = await injectTextIntoLexical(lyricElement, acc.lyrics);
            if (!ok) addLog('Lyrics inject uncertain — React may have fought back.', '#f59e0b');
            await sleep(300);
        }

        if (acc.styles) {
            const styleField = findStylesField();
            if (styleField) {
                setNativeValue(styleField, acc.styles);
                await sleep(300);
                if (retries === 3) addLog('Styles filled', '#22c55e');
            } else {
                addLog('Styles field nowhere to be found', '#f59e0b');
            }
        }

        if (acc.songName) {
            const nameSel = 'input[placeholder*="song title" i], input[placeholder*="title (optional)" i], input[placeholder*="enter a title" i], input[placeholder*="title" i]:not([placeholder*="search" i])';
            const nameInput = document.querySelector(nameSel);
            if (nameInput && !isInsideSearchOrHeader(nameInput)) {
                setNativeValue(nameInput, acc.songName);
                await sleep(300);
            }
        }

        if (acc.voice && acc.voice !== 'none') {
            const btns = [...document.querySelectorAll('button, [role="button"]')];
            const voiceBtn = btns.find(b => b.textContent.trim().toLowerCase() === acc.voice.toLowerCase() && !isInsideSearchOrHeader(b));
            if (voiceBtn) { voiceBtn.click(); await sleep(300); }
        }

        if (acc.lyrics && retries > 0) {
            const currentText = lyricElement.isContentEditable ? (lyricElement.innerText || '') : (lyricElement.value || '');
            if (currentText.trim().length === 0) {
                addLog('React wiped the lyrics like a thief. Forcing it back in...', '#f59e0b');
                await sleep(1000);
                return fillSunoForm(acc, retries - 1);
            }
        }

        addLog('Form filled flawlessly. Like clockwork.', '#22c55e');
        return true;
    }

    async function signOutClerk() {
        console.log('[SND] Burning down the old session');
        try {
            for (let i = 0; i < 20 && !unsafeWindow.Clerk?.signOut; i++) await sleep(250);
            if (unsafeWindow.Clerk?.signOut) { try { await unsafeWindow.Clerk.signOut(); addLog('Clerk.signOut() triggered', '#22c55e'); await sleep(800); } catch (e) { console.warn('[SND] Clerk.signOut error:', e); } }
            const ls = unsafeWindow.localStorage;
            const keysToRemove = Object.keys(ls).filter(k => k.includes('clerk') || k.includes('__session') || k.includes('__client') || k.includes('auth') || k.includes('suno') || k.includes('token'));
            keysToRemove.forEach(k => ls.removeItem(k));
            try { unsafeWindow.sessionStorage.clear(); } catch (e) { }
            document.cookie.split(';').forEach(c => { const name = c.trim().split('=')[0]; if (!name) return; document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.suno.com`; document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; });
            GM_setValue('snd_auth', null); capturedAuth = null;
            addLog('Session wiped clean. No bullshit left.', '#22c55e');
        } catch (e) { addLog('Sign out choked: ' + e.message, '#ef4444'); }
    }

    function normalizeEmail(s) { return (s || '').trim().toLowerCase(); }
    function collectEmails(value, out = new Set(), depth = 0) {
        if (value == null || depth > 6) return out;
        if (typeof value === 'string') { const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig); if (matches) matches.forEach(e => out.add(normalizeEmail(e))); return out; }
        if (typeof value !== 'object') return out;
        if (Array.isArray(value)) { value.forEach(v => collectEmails(v, out, depth + 1)); return out; }
        Object.keys(value).forEach(k => collectEmails(value[k], out, depth + 1));
        return out;
    }

    function getSunoLoggedInEmails() {
        const emails = new Set();
        try { const user = unsafeWindow.Clerk?.user; collectEmails(user?.primaryEmailAddress?.emailAddress, emails); collectEmails(user?.emailAddresses, emails); collectEmails(user, emails, 4); } catch (e) { }
        try {
            const ls = unsafeWindow.localStorage;
            Object.keys(ls).forEach(k => { if (!/clerk|session|client|user|auth/i.test(k)) return; const raw = ls.getItem(k); if (!raw || !raw.includes('@')) return; collectEmails(raw, emails); if (raw[0] === '{' || raw[0] === '[') { try { collectEmails(JSON.parse(raw), emails); } catch (e) { } } });
        } catch (e) { }
        return [...emails].filter(Boolean);
    }

    function isSunoSigninPath() { return location.pathname.includes('sign-in') || location.pathname.includes('login') || location.pathname.includes('sign_in'); }
    function isSunoCreatePath() { return location.pathname === '/create' || location.pathname.startsWith('/create/'); }
    function goToCreate(reason = 'create-required') { if (isSunoCreatePath()) return false; console.log('[SND] redirecting to /create:', reason); unsafeWindow.location.replace('https://suno.com/create'); return true; }
    function getCurrentAccount() { const auto = getAuto(); const accounts = getAccounts(); return accounts[auto.currentIdx] || null; }

    let widgetGuardInstalled = false;

    function installWidgetGuard() {
        if (widgetGuardInstalled || !IS_SUNO) return;
        widgetGuardInstalled = true;

        const safeCreateWidget = () => {
            if (document.getElementById('snd-widget')) return;
            if (document.body) {
                createWidget();
            } else {
                waitForBody(createWidget);
            }
        };

        setInterval(safeCreateWidget, 2000);

        const observer = new MutationObserver(() => {
            if (!document.getElementById('snd-widget')) safeCreateWidget();
        });
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
            waitForBody(() => observer.observe(document.documentElement, { childList: true, subtree: true }));
        }

        const wrapHistory = (method) => {
            try {
                const orig = unsafeWindow.history[method];
                unsafeWindow.history[method] = function (...args) {
                    const ret = orig.apply(this, args);
                    setTimeout(safeCreateWidget, 200);
                    return ret;
                };
            } catch (e) { }
        };
        wrapHistory('pushState'); wrapHistory('replaceState');
        unsafeWindow.addEventListener('popstate', () => setTimeout(safeCreateWidget, 200));
    }

    function ensureWidget() {
        if (document.getElementById('snd-widget')) { updateDot(); return; }
        waitForBody(() => { if (!document.getElementById('snd-widget')) createWidget(); installWidgetGuard(); });
    }

    function ensureWidgetSoon() { setTimeout(ensureWidget, 100); installWidgetGuard(); }

    async function completeOAuthLogin() {
        if (oauthReturnProcessed) return;
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return;
        if (auto.step !== 'login_pending' || !auto.oauthVisited) return;
        oauthReturnProcessed = true;
        reloginInFlight = false;
        document.getElementById('snd-overlay')?.remove();
        ensureWidget();
        const accounts = getAccounts();
        const acc = accounts[auto.currentIdx];
        if (!acc) { saveAuto({}); return; }
        const updated = { ...auto, step: 'post_login', active: true, reloginAttempts: 0, graceUntil: Date.now() + 120000, oauthJustCompleted: true };
        saveAuto(updated);
        if (!isSunoCreatePath()) { goToCreate('oauth-return'); return; }
        await sleep(3000);
        if (acc.autoFill) await fillSunoForm(acc);
        setStatus(`Ready! Logged in as ${acc.name || acc.email}.`);
        addLog(`Logged in: ${acc.name || acc.email}. About damn time.`, '#22c55e');
        saveAuto({ ...updated, step: 'idle', active: false, oauthJustCompleted: false });

        if (GM_getValue('snd_auto_spam_fresh', false) && !spamState.running && isSunoCreatePath()) {
            const credits = await fetchCredits();
            if (credits !== null && credits >= 45) {
                addLog('Fresh credits detected. Auto-starting spam.', '#22c55e');
                await startSpam();
            }
        }
    }

    function checkSunoCachedLogin(reason = 'watchdog') {
        if (!IS_SUNO || isSunoSigninPath()) return false;
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return false;
        const acc = getAccounts()[auto.currentIdx];
        if (!acc) return false;
        if (auto.oauthJustCompleted || auto.step === 'post_login') { completeOAuthLogin(); return true; }
        if (auto.step === 'idle') return false;
        const emailState = getSunoLoggedInEmails(acc.email);
        const noProviderRoundtrip = auto.step === 'login_pending' && !auto.oauthVisited;
        const stillSigningOut = auto.step === 'signout_pending';
        if (emailState === 'mismatch' || noProviderRoundtrip || stillSigningOut) {
            console.warn('[SND] cached login mismatch:', { reason, emailState, step: auto.step });
            restartLoginAfterCachedSession(emailState === 'mismatch' ? `${reason}-email-mismatch` : `${reason}-cached-suno-session`);
            return true;
        }
        if (auto.step === 'login_pending' && auto.oauthVisited) { completeOAuthLogin(); return true; }
        return false;
    }

    async function restartLoginAfterCachedSession(reason) {
        const auto = getAuto();
        if (!auto.active && !auto.pendingLogin) return false;
        if (reloginInFlight) return true;
        reloginInFlight = true;
        const attempts = Number(auto.reloginAttempts || 0);
        if (attempts >= 4) { showPageOverlay('Cached session loop threw a fit.\nPress Stop and reset it manually.'); reloginInFlight = false; return false; }
        const next = { ...auto, step: 'signout_pending', oauthVisited: false, reloginAttempts: attempts + 1, reloginReason: reason, lastRestartAt: Date.now() };
        saveAuto(next);
        showPageOverlay(`Flushing old Suno session...\nRetry ${attempts + 1}/4`);
        GM_setValue('snd_auth', null); capturedAuth = null;
        await signOutClerk(); await sleep(1000);
        saveAuto({ ...next, step: 'login_pending' });
        unsafeWindow.location.href = `https://suno.com/sign-in?__snd_relogin=${Date.now()}`;
        return true;
    }

    function installSunoLoginWatchdog() {
        if (!IS_SUNO || sunoLoginWatchdogInstalled) return;
        sunoLoginWatchdogInstalled = true;
        const scheduleCheck = (reason) => { setTimeout(() => checkSunoCachedLogin(reason), 250); setTimeout(() => checkSunoCachedLogin(reason + '-late'), 1500); };
        try {
            const origPush = unsafeWindow.history.pushState;
            unsafeWindow.history.pushState = function (...args) { const ret = origPush.apply(this, args); scheduleCheck('history-push'); return ret; };
            const origReplace = unsafeWindow.history.replaceState;
            unsafeWindow.history.replaceState = function (...args) { const ret = origReplace.apply(this, args); scheduleCheck('history-replace'); return ret; };
        } catch (e) { }
        unsafeWindow.addEventListener('popstate', () => scheduleCheck('popstate'));
        setInterval(() => checkSunoCachedLogin('poll'), 3000);
        scheduleCheck('install');
    }

    async function afterDownloadChain() {
        const accounts = getAccounts();
        const enabled = accounts.map((a, i) => ({ a, i })).filter(x => x.a.enabled && !x.a.done);
        if (enabled.length === 0) {
            addLog('All enabled accounts are done! Chain finished. Go grab a dumbbell.', '#22c55e');
            setStatus('All accounts done. Chain finished.');
            saveAuto({ chainEnabled: true });
            return;
        }
        const nextEntry = enabled[0];
        addLog(`Starting auto-chain, moving to: ${nextEntry.a.name || nextEntry.a.email}`, '#d4a574');
        setStatus('Signing out and swapping accounts...');
        saveAuto({ active: true, chainEnabled: true, currentIdx: nextEntry.i, step: 'signout_pending', oauthVisited: false, reloginAttempts: 0 });
        await sleep(1000); await signOutClerk(); await sleep(1500);
        saveAuto({ active: true, chainEnabled: true, currentIdx: nextEntry.i, step: 'login_pending', oauthVisited: false, reloginAttempts: 0 });
        unsafeWindow.location.href = 'https://suno.com/sign-in';
    }

    function markAccountDone(idx) { const accounts = getAccounts(); if (idx >= 0 && idx < accounts.length) { accounts[idx].done = true; saveAccounts(accounts); renderAccounts(); } }
    function toggleAccountEnabled(idx) { const accounts = getAccounts(); if (idx >= 0 && idx < accounts.length) { accounts[idx].enabled = !accounts[idx].enabled; saveAccounts(accounts); renderAccounts(); } }
    async function loginAccount(idx) {
        const accounts = getAccounts(); const acc = accounts[idx]; if (!acc) return;
        saveAuto({ active: false, pendingLogin: true, currentIdx: idx, step: 'signout_pending', oauthVisited: false, reloginAttempts: 0 });
        GM_setValue('snd_auth', null); capturedAuth = null;
        showPageOverlay(`Clearing current session...\nNext: ${acc.email}`);
        await signOutClerk(); await sleep(800);
        saveAuto({ active: false, pendingLogin: true, currentIdx: idx, step: 'login_pending', oauthVisited: false, reloginAttempts: 0 });
        unsafeWindow.location.href = 'https://suno.com/sign-in';
    }

    function resolveUrl(track, fmt) {
        if (!track) return null;
        if (fmt === 'wav') {
            const wav = track.wav_audio_url || track.wave_audio_url || track.audio_url_wav || track.hq_audio_url || null;
            if (wav) return { url: wav, ext: 'wav' };
            const mp3url = track.audio_url || track.audio || '';
            if (mp3url) return { url: mp3url.replace(/\.mp3(\?|$)/, '.wav$1'), ext: 'wav', guessed: true };
            return null;
        }
        const url = track.audio_url || track.audio || track.stream_url || track.url || '';
        return url ? { url, ext: 'mp3' } : null;
    }

    async function fetchTracks(n) {
        return new Promise((resolve, reject) => {
            if (!capturedAuth) { reject(new Error('No auth token')); return; }
            const headers = { 'Content-Type': 'application/json', 'Authorization': capturedAuth, 'Accept': '*/*', 'Origin': 'https://suno.com', 'Referer': 'https://suno.com/' };
            if (capturedBrowser) headers['browser-token'] = capturedBrowser;
            if (capturedDevice) headers['device-id'] = capturedDevice;
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://studio-api-prod.suno.com/api/feed/v3', headers, responseType: 'json',
                data: JSON.stringify({ cursor: null, limit: n, filters: { disliked: "False", trashed: "False", fromStudioProject: { presence: "False" }, stem: { presence: "False" } } }),
                onload: r => { try { const data = r.response || JSON.parse(r.responseText); const clips = data.clips || data.data || (Array.isArray(data) ? data : []); if (!clips.length) { reject(new Error('Empty clips')); return; } clips.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()); resolve(clips.slice(0, n)); } catch (e) { reject(e); } },
                onerror: e => reject(new Error('Network choked: ' + JSON.stringify(e)))
            });
        });
    }

    async function embedMetadataIntoMp3(blob, lyricsText, titleOverride) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const arrayBuffer = e.target.result;
                    const writer = new ID3Writer(arrayBuffer);
                    const T = getTagSettings();
                    const lang = T.language || 'eng';

                    // Title — from track metadata (passed in), never from tags panel (user fills manually)
                    if (titleOverride) writer.setFrame('TIT2', titleOverride);

                    // Artists
                    if (T.artist)          writer.setFrame('TPE1', [T.artist]);
                    if (T.album_artist)    writer.setFrame('TPE2', T.album_artist);
                    if (T.original_artist) writer.setFrame('TOPE', T.original_artist);
                    if (T.composer)        writer.setFrame('TCOM', [T.composer]);
                    if (T.lyricist)        writer.setFrame('TEXT', [T.lyricist]);
                    if (T.conductor)       writer.setFrame('TPE3', T.conductor);
                    if (T.remixer)         writer.setFrame('TPE4', T.remixer);

                    // Album / Release
                    if (T.album)           writer.setFrame('TALB', T.album);
                    if (T.disc) {
                        const discStr = T.disc_total ? `${T.disc}/${T.disc_total}` : T.disc;
                        writer.setFrame('TPOS', discStr);
                    }

                    // Date — auto year/month
                    if (T.year)            writer.setFrame('TYER', T.year);
                    if (T.year && T.date)  writer.setFrame('TDRC', `${T.year}-${T.date}`);
                    if (T.original_year)   writer.setFrame('TORY', T.original_year);

                    // Genre / Mood
                    if (T.genre)           writer.setFrame('TCON', T.genre);
                    if (T.mood)            writer.setFrame('TMOO', T.mood);

                    // Rights / Publishing
                    if (T.copyright)       writer.setFrame('TCOP', T.copyright);
                    if (T.publisher)       writer.setFrame('TPUB', T.publisher);
                    if (T.encoded_by)      writer.setFrame('TENC', T.encoded_by);
                    if (T.encoding_tool)   writer.setFrame('TSSE', T.encoding_tool);
                    if (T.isrc)            writer.setFrame('TSRC', T.isrc);

                    // Comment
                    if (T.comment) writer.setFrame('COMM', { language: lang, description: '', text: T.comment });

                    // Lyrics (embedded, from track metadata or account field)
                    if (lyricsText && lyricsText.trim().length > 0) {
                        writer.setFrame('USLT', { language: lang, description: '', lyrics: lyricsText });
                    }

                    // URLs
                    if (T.url)              writer.setFrame('WXXX', { description: 'Artist', url: T.url });
                    if (T.url_artist)       writer.setFrame('WOAR', T.url_artist);
                    if (T.url_audio_source) writer.setFrame('WOAS', T.url_audio_source);
                    if (T.url_publisher)    writer.setFrame('WPUB', T.url_publisher);

                    // BPM / Key / Language
                    if (T.bpm)      writer.setFrame('TBPM', T.bpm);
                    if (T.key)      writer.setFrame('TKEY', T.key);
                    if (T.language) writer.setFrame('TLAN', T.language);

                    writer.addTag();
                    const taggedBlob = new Blob([writer.arrayBuffer], { type: 'audio/mpeg' });
                    resolve(taggedBlob);
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    async function downloadTrack(track, index, total, fmt, accountLyrics) {
        return new Promise(async (resolve) => {
            const resolved = resolveUrl(track, fmt);
            const title = track.title || track.name || `track_${index + 1}`;
            if (!resolved) { addLog(`[${index + 1}/${total}] URL MIA for: ${title}`, '#f59e0b'); resolve('skip'); return; }
            const { url, ext, guessed } = resolved;
            const idxStr = String(index + 1).padStart(2, '0');
            let filename = `${idxStr}_${sanitizeFilename(title)}.${ext}`;
            if (guessed) addLog(`[${index + 1}/${total}] WAV guessed, crossing fingers...`, '#f59e0b');
            setStatus(`Pulling ${index + 1}/${total} [${ext.toUpperCase()}]: ${title}`);
            addLog(`[${index + 1}/${total}] ${title}`, '#d4a574');

            const trackLyrics = track.lyric_text || track.lyrics || track.metadata?.prompt || track.metadata?.lyrics || '';
            const lyricsText = (trackLyrics && trackLyrics.trim()) || (accountLyrics && accountLyrics.trim()) || '';
            if (lyricsText) addLog(`[${index + 1}/${total}] Lyrics locked: ${lyricsText.length} chars`, '#8b7355');
            else addLog(`[${index + 1}/${total}] Zero lyrics. Dry.`, '#8b7355');

            const T = getTagSettings();
            const hasAnyMetadata = lyricsText || T.artist || T.album || T.year || T.genre || T.comment;
            const needEmbed = fmt === 'mp3' && hasAnyMetadata;

            if (needEmbed) {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'blob',
                    onload: async (r) => {
                        try {
                            let finalBlob = r.response;
                            finalBlob = await embedMetadataIntoMp3(finalBlob, lyricsText, title);
                            const blobUrl = URL.createObjectURL(finalBlob);
                            const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename, style: 'display:none' });
                            document.body.appendChild(a); a.click();
                            setTimeout(() => { URL.revokeObjectURL(blobUrl); a.remove(); }, 3000);
                            addLog(`OK + tags [${index + 1}/${total}]`, '#22c55e');
                            resolve('ok');
                        } catch (err) {
                            addLog(`Tags choked: ${err.message}`, '#ef4444');
                            try {
                                const fallbackUrl = URL.createObjectURL(r.response);
                                const a = Object.assign(document.createElement('a'), { href: fallbackUrl, download: filename });
                                document.body.appendChild(a); a.click();
                                setTimeout(() => { URL.revokeObjectURL(fallbackUrl); a.remove(); }, 3000);
                                resolve('ok');
                            } catch (e2) { resolve('error'); }
                        }
                    },
                    onerror: () => { addLog(`NET ERR [${index + 1}/${total}]`, '#ef4444'); resolve('error'); }
                });
            } else {
                try {
                    GM_download({ url, name: filename, saveAs: false, onload: () => { addLog(`OK [${index + 1}/${total}]`, '#22c55e'); resolve('ok'); }, onerror: () => blobDownload(url, filename, index, total, title, ext, resolve), ontimeout: () => { addLog(`Timeout [${index + 1}/${total}]`, '#ef4444'); resolve('timeout'); } });
                } catch (e) { blobDownload(url, filename, index, total, title, ext, resolve); }
            }
        });
    }

    function blobDownload(url, filename, index, total, title, ext, resolve) {
        GM_xmlhttpRequest({ method: 'GET', url, responseType: 'blob', onload: r => { try { const blobUrl = URL.createObjectURL(r.response); const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename, style: 'display:none' }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(blobUrl); a.remove(); }, 3000); addLog(`OK blob [${index + 1}/${total}]`, '#22c55e'); resolve('ok'); } catch (e) { addLog(`ERR: ${e.message}`, '#ef4444'); resolve('error'); } }, onerror: () => { addLog(`NET ERR [${index + 1}/${total}]`, '#ef4444'); resolve('error'); } });
    }

    async function waitForGenerations() {
        addLog('Waiting for these damn generations to finish...', '#f59e0b');
        setStatus('Waiting for generations. Tap your fingers...');
        let attempts = 0;
        while (attempts < 120) {
            try {
                const tracks = await fetchTracks(15);
                if (!tracks || !tracks.length) return false;
                const isRunning = tracks.some(t => {
                    const st = (t.status || '').toLowerCase();
                    return st === 'running' || st === 'submitted' || st === 'queued' || st === 'streaming';
                });
                if (!isRunning) {
                    addLog('Generations done. Finally.', '#22c55e');
                    return true;
                }
                setStatus(`Still waiting... (${attempts}/120)`);
            } catch (e) { }
            await sleep(3000);
            attempts++;
        }
        addLog('Patience ran out. Sending it anyway, to hell with it.', '#ef4444');
        return false;
    }

    async function runDownload(n, fmt, currentAccount) {
        isWorking = true;
        cancelRequested = false;
        setProgress(0, n);
        try {
            const tracks = await fetchTracks(n);
            let success = 0;
            for (let i = 0; i < tracks.length; i++) {
                if (cancelRequested) {
                    addLog('Cancelled by user. You boss.', '#f59e0b');
                    break;
                }
                const result = await downloadTrack(tracks[i], i, tracks.length, fmt, currentAccount?.lyrics || '');
                if (result === 'ok') success++;
                setProgress(i + 1, n);
            }
            setProgress(n, n);
            return success > 0;
        } catch (e) {
            addLog(`Download blew up: ${e.message}`, '#ef4444');
            return false;
        } finally {
            isWorking = false;
        }
    }

    async function startDownload() {
        if (isWorking) return;
        if (!capturedAuth) { setStatus('No auth! You think I run on magic? Log in.'); return; }

        const n = parseInt(document.getElementById('snd-n')?.value) || 10;
        const fmt = document.getElementById('snd-widget')?._getFormat() || 'mp3';
        const auto = getAuto();
        const accounts = getAccounts();
        const currentAccount = auto.active ? accounts[auto.currentIdx] : null;

        if (document.getElementById('snd-wait-gen')?.checked) {
            await waitForGenerations();
        }

        const ok = await runDownload(n, fmt, currentAccount);
        if (ok) {
            if (auto.active && currentAccount) {
                markAccountDone(auto.currentIdx);
                addLog(`Auto-marked "${currentAccount.name || currentAccount.email}" as done. Next.`, '#22c55e');
            }

            const autoNext = document.getElementById('snd-auto-next')?.checked;
            if (autoNext) {
                setStatus('Done! Signing out in 2s...');
                addLog('Signing out, on to the next one...', '#d4a574');
                await sleep(2000);
                await afterDownloadChain();
            } else {
                setStatus('Done! Auto-chain off.');
            }
        }
    }

    async function fetchCredits() {
        return new Promise((resolve) => {
            if (!capturedAuth) { resolve(null); return; }
            const headers = { 'Authorization': capturedAuth, 'Accept': '*/*', 'Origin': 'https://suno.com' };
            if (capturedBrowser) headers['browser-token'] = capturedBrowser;
            if (capturedDevice) headers['device-id'] = capturedDevice;
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://studio-api-prod.suno.com/api/billing/info',
                headers,
                onload: r => {
                    try {
                        let data;
                        try { data = JSON.parse(r.responseText); } catch (e) { data = r.response; }
                        if (!data || typeof data !== 'object') { resolve(null); return; }
                        const val = data.total_credits_left !== undefined ? data.total_credits_left
                            : data.credits_left !== undefined ? data.credits_left
                                : data.remaining_credits !== undefined ? data.remaining_credits
                                    : data.credits !== undefined ? data.credits : undefined;
                        if (val === undefined) { resolve(null); return; }
                        const num = parseFloat(val);
                        resolve(isNaN(num) ? null : num);
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    }

    async function initiateZeroCreditsWrapUp() {
        if (isWrappingUp || isWorking) return;
        isWrappingUp = true;
        addLog('Wrapping this up...', '#f59e0b');

        if (document.getElementById('snd-wait-gen')?.checked) {
            await waitForGenerations();
        }

        if (document.getElementById('snd-auto-next')?.checked) {
            await startDownload();
        } else {
            addLog('Auto-next disabled. Wrap-up finished.', '#b8956a');
        }
        isWrappingUp = false;
    }

    async function updateCreditsDisplay() {
        const credits = await fetchCredits();
        const el = document.getElementById('snd-credits');
        if (el && credits !== null) el.textContent = `Credits: ${credits}`;

        if (credits !== null && credits >= 10) outOfCreditsLogged = false;
        if (credits !== null && credits < 10) {
            const nInput = document.getElementById('snd-n');
            if (nInput) {
                const currentN = parseInt(nInput.value) || 10;
                const targetN = 10;
                if (targetN > currentN) {
                    nInput.value = targetN;
                    addLog(`Zero credits! Adjusting tracks to pull: ${targetN}`, '#22c55e');
                }
            }
            if (!outOfCreditsLogged) {
                outOfCreditsLogged = true;
                addLog('Out of credits! You broke bastard.', '#ef4444');
                if (spamState.running) stopSpam('out-of-credits');
                markCurrentAccountDoneIfOutOfCredits();

                const autoNext = document.getElementById('snd-auto-next')?.checked;
                if (autoNext && !isWrappingUp && !isWorking) {
                    initiateZeroCreditsWrapUp();
                }
            }
        }
        return credits;
    }

    function markCurrentAccountDoneIfOutOfCredits() {
        const auto = getAuto();
        const accounts = getAccounts();
        let marked = false;
        if ((auto.active || auto.pendingLogin) && auto.currentIdx !== undefined && accounts[auto.currentIdx]) {
            if (!accounts[auto.currentIdx].done) {
                accounts[auto.currentIdx].done = true;
                saveAccounts(accounts);
                addLog(`Marked active account "${accounts[auto.currentIdx].email}" as Done.`, '#ef4444');
                renderAccounts();
                marked = true;
            }
        }
        if (!marked) {
            const loggedEmails = getSunoLoggedInEmails();
            if (loggedEmails.length) {
                const matchIdx = accounts.findIndex(acc => loggedEmails.includes(normalizeEmail(acc.email)));
                if (matchIdx !== -1 && !accounts[matchIdx].done) {
                    accounts[matchIdx].done = true;
                    saveAccounts(accounts);
                    addLog(`Marked logged account "${accounts[matchIdx].email}" as Done.`, '#ef4444');
                    renderAccounts();
                }
            }
        }
    }

    async function startSpam() {
        if (!capturedAuth) { setStatus('No auth! Log in first.'); return; }
        if (spamState.running) { stopSpam('restart'); return; }
        outOfCreditsLogged = false;
        const saved = getSpamSettings();
        const burstSize = parseInt(document.getElementById('snd-burst-size')?.value) || saved.burstSize || 5;
        const burstInterval = parseInt(document.getElementById('snd-burst-interval')?.value) || saved.burstInterval || 75;
        const burstGroupInterval = parseInt(document.getElementById('snd-burst-group-interval')?.value) || saved.burstGroupInterval || 500;
        const burstsPerGroup = parseInt(document.getElementById('snd-bursts-per-group')?.value) || saved.burstsPerGroup || 2;
        const cooldown = parseInt(document.getElementById('snd-cooldown')?.value) || saved.cooldown || 60;
        const totalGroups = parseInt(document.getElementById('snd-total-groups')?.value) || saved.totalGroups || 999;
        if (burstSize < 1 || burstInterval < 10 || burstGroupInterval < 0 || burstsPerGroup < 1 || cooldown < 1 || totalGroups < 1) { setStatus('Invalid spam numbers. Stop putting garbage in the inputs.'); return; }
        saveSpamSettings({ burstSize, burstInterval, burstGroupInterval, burstsPerGroup, cooldown, totalGroups });
        spamState.running = true; spamState.currentGroup = 1; spamState.currentBurstInGroup = 1;
        spamState.burstSize = burstSize; spamState.burstInterval = burstInterval; spamState.burstGroupInterval = burstGroupInterval;
        spamState.burstsPerGroup = burstsPerGroup; spamState.cooldown = cooldown; spamState.totalGroups = totalGroups;
        spamState.outOfCredits = false;
        const btn = document.getElementById('snd-spam-toggle');
        if (btn) { btn.textContent = 'Stop Spam'; btn.style.background = '#7f1d1d'; }
        updateSpamStatusDisplay();
        setStatus('Spam started...');
        addLog('Spam started. Hammering the button...', '#f59e0b');
        fireBurst();
        updateCreditsDisplay().then(initialCredits => {
            if (initialCredits !== null && initialCredits < 10 && spamState.running) {
                stopSpam('out-of-credits');
            }
        });
    }

    function stopSpam(reason = 'manual') {
        if (!spamState.running) return;
        spamState.running = false;
        if (spamState.burstTimer) clearTimeout(spamState.burstTimer);
        if (spamState.cooldownTimer) clearTimeout(spamState.cooldownTimer);
        spamState.burstTimer = null; spamState.cooldownTimer = null;
        const btn = document.getElementById('snd-spam-toggle');
        if (btn) { btn.textContent = 'Start Spam'; btn.style.background = '#4d3e2c'; }
        updateSpamStatusDisplay(); updateCreditsDisplay();
        setStatus(`Spam stopped: ${reason}.`);
        addLog(`Spam stopped (${reason}). Finger off the trigger.`, '#f59e0b');
    }

    async function fireBurst() {
        try {
            if (!spamState.running || spamState.outOfCredits) return;

            const group = spamState.currentGroup;
            const burstInGroup = spamState.currentBurstInGroup;
            updateSpamStatusDisplay();
            setStatus(`Hammering: G${group}/${spamState.totalGroups} B${burstInGroup}/${spamState.burstsPerGroup}...`);
            addLog(`Group ${group} Burst ${burstInGroup} (${spamState.burstSize} clicks)`, '#d4a574');

            const findCreateBtn = () => {
                const candidates = [...document.querySelectorAll('button, [role="button"]')];
                return candidates.find(b => /^create$/i.test(b.textContent.trim()) && !isInsideSearchOrHeader(b)) ||
                    candidates.find(b => /create/i.test(b.textContent.trim()) && b.type !== 'reset' && !isInsideSearchOrHeader(b)) ||
                    document.querySelector('[data-testid="create-button"]') ||
                    null;
            };

            for (let i = 0; i < spamState.burstSize; i++) {
                if (!spamState.running || spamState.outOfCredits) break;
                const btn = findCreateBtn();
                if (!btn) {
                    addLog(`Create button MIA (G${group} B${burstInGroup}/${i + 1}). Pausing for a sec instead of crying about it.`, '#f59e0b');
                    spamState.burstTimer = setTimeout(() => { if (spamState.running) fireBurst(); }, 1500);
                    return;
                }
                btn.click();
                await sleep(spamState.burstInterval);
            }

            if (!spamState.running) return;
            await updateCreditsDisplay();
            if (spamState.outOfCredits || !spamState.running) return;

            if (spamState.currentBurstInGroup < spamState.burstsPerGroup) {
                spamState.currentBurstInGroup++;
                updateSpamStatusDisplay(`Next burst in ${spamState.burstGroupInterval}ms...`);
                spamState.burstTimer = setTimeout(() => { spamState.burstTimer = null; if (spamState.running) fireBurst(); }, spamState.burstGroupInterval);
            } else {
                spamState.currentGroup++;
                spamState.currentBurstInGroup = 1;
                if (spamState.currentGroup <= spamState.totalGroups) {
                    updateSpamStatusDisplay(`Cooldown ${spamState.cooldown}s before next group...`);
                    spamState.cooldownTimer = setTimeout(() => { spamState.cooldownTimer = null; if (spamState.running) fireBurst(); }, spamState.cooldown * 1000);
                } else {
                    stopSpam('completed');
                }
            }
        } catch (e) {
            addLog(`Spam choked on an error: ${e.message}. Retrying...`, '#ef4444');
            spamState.burstTimer = setTimeout(() => { if (spamState.running) fireBurst(); }, 2000);
        }
    }

    function updateSpamStatusDisplay(extra = '') {
        const el = document.getElementById('snd-spam-status');
        if (!el) return;
        if (!spamState.running) { el.textContent = 'Ready'; return; }
        const g = spamState.currentGroup || 1;
        const b = spamState.currentBurstInGroup || 1;
        el.textContent = `G${g}/${spamState.totalGroups} B${b}/${spamState.burstsPerGroup}` + (extra ? ' ' + extra : '');
    }

    function getTemplates() { try { return JSON.parse(GM_getValue('snd_templates', '[]')); } catch (e) { return []; } }
    function saveTemplates(tpls) { GM_setValue('snd_templates', JSON.stringify(tpls)); }

    function renderTemplatesPanel() {
        const panel = document.getElementById('snd-panel-tpl');
        if (!panel) return;
        const templates = getTemplates();
        const listDiv = document.getElementById('snd-tpl-list');
        if (!listDiv) return;
        if (templates.length === 0) { listDiv.innerHTML = '<div style="color:#969696;font-size:12px;text-align:center;padding:12px 0;">No templates yet. Create one!</div>'; return; }
        listDiv.innerHTML = '';
        templates.forEach((tpl, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#1E1E1E;border-radius:2px;padding:8px 10px;margin-bottom:8px;border:1px solid #808080;';
            card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><strong style="color:#C0C0C0;font-size:12px;">${parseHtml(tpl.name)}</strong><div><button class="snd-tpl-apply" data-idx="${idx}" style="background:#178CFC;color:#fff;border:none;border-radius:2px;padding:2px 8px;font-size:11px;margin-right:4px;">Apply</button><button class="snd-tpl-edit" data-idx="${idx}" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:2px 8px;font-size:11px;margin-right:4px;">Edit</button><button class="snd-tpl-del" data-idx="${idx}" style="background:#800000;color:#fff;border:none;border-radius:2px;padding:2px 8px;font-size:11px;">Del</button></div></div><div style="font-size:11px;color:#969696;margin-top:4px;">${tpl.lyrics ? `<div><span style="color:#C0C0C0;">Lyrics:</span> ${parseHtml(tpl.lyrics.substring(0, 60))}${tpl.lyrics.length > 60 ? '...' : ''}</div>` : ''}${tpl.styles ? `<div><span style="color:#C0C0C0;">Styles:</span> ${parseHtml(tpl.styles.substring(0, 60))}${tpl.styles.length > 60 ? '...' : ''}</div>` : ''}</div>`;
            listDiv.appendChild(card);
        });
        document.querySelectorAll('.snd-tpl-apply').forEach(btn => btn.onclick = (e) => applyTemplateByIdx(parseInt(btn.getAttribute('data-idx'), 10)));
        document.querySelectorAll('.snd-tpl-edit').forEach(btn => btn.onclick = (e) => openTemplateModal(parseInt(btn.getAttribute('data-idx'), 10)));
        document.querySelectorAll('.snd-tpl-del').forEach(btn => btn.onclick = (e) => { if (confirm('Delete this template?')) { const tpls = getTemplates(); tpls.splice(parseInt(btn.getAttribute('data-idx'), 10), 1); saveTemplates(tpls); renderTemplatesPanel(); } });
    }

    function openTemplateModal(editIdx = null) {
        if (currentModalBackdrop) currentModalBackdrop.remove();
        const templates = getTemplates();
        let tpl = editIdx !== null ? { ...templates[editIdx] } : { id: uid(), name: '', lyrics: '', styles: '' };
        const backdrop = document.createElement('div');
        backdrop.className = 'snd-modal-backdrop';
        backdrop.innerHTML = `<div class="snd-modal" style="width:calc(100vw - 32px);max-width:360px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-weight:700;font-size:14px;color:#C0C0C0;">${editIdx === null ? 'Add Template' : 'Edit Template'}</span><button id="tpl-close" style="background:none;border:none;color:#808080;font-size:18px;cursor:pointer;">X</button></div><label>Template Name</label><input id="tpl-name" value="${parseHtml(tpl.name)}" placeholder="My template" style="margin-bottom:10px;"/><label>Lyrics</label><textarea id="tpl-lyrics" placeholder="Paste lyrics here..." rows="4" style="margin-bottom:10px;">${parseHtml(tpl.lyrics)}</textarea><label>Styles</label><textarea id="tpl-styles" placeholder="e.g. pop rock, emotional, piano" rows="2" style="margin-bottom:10px;">${parseHtml(tpl.styles)}</textarea><div style="display:flex;gap:8px;margin-top:10px;"><button id="tpl-save" style="flex:1;background:#178CFC;color:#fff;border:none;border-radius:2px;padding:8px 0;font-weight:600;font-size:13px;">Save</button><button id="tpl-cancel" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:8px 14px;font-size:13px;">Cancel</button></div></div>`;
        document.body.appendChild(backdrop);
        currentModalBackdrop = backdrop;
        document.getElementById('tpl-close').onclick = () => { backdrop.remove(); currentModalBackdrop = null; };
        document.getElementById('tpl-cancel').onclick = () => { backdrop.remove(); currentModalBackdrop = null; };
        document.getElementById('tpl-save').onclick = () => {
            const newName = document.getElementById('tpl-name').value.trim();
            if (!newName) { alert('Give it a damn name, don\'t leave it blank!'); return; }
            const updated = { id: tpl.id, name: newName, lyrics: document.getElementById('tpl-lyrics').value, styles: document.getElementById('tpl-styles').value };
            if (editIdx === null) templates.push(updated); else templates[editIdx] = updated;
            saveTemplates(templates); backdrop.remove(); currentModalBackdrop = null; renderTemplatesPanel();
        };
    }

    async function applyTemplateByIdx(idx) {
        const templates = getTemplates();
        const tpl = templates[idx];
        if (!tpl) return;
        if (!isSunoCreatePath()) { addLog(`Navigating to /create for template "${tpl.name}"...`, '#d4a574'); goToCreate('apply-template'); let attempts = 0; while (!isSunoCreatePath() && attempts < 20) { await sleep(500); attempts++; } await sleep(1500); }

        const lyricElement = await waitForCreateForm();
        if (!lyricElement) { addLog('Create form didn\'t show up. Stop staring and reload the page.', '#ef4444'); return; }

        if (tpl.lyrics) {
            const ok = await injectTextIntoLexical(lyricElement, tpl.lyrics);
            if (ok) addLog('Lyrics filled.', '#22c55e');
            else addLog('Lyrics inject uncertain — check the field.', '#f59e0b');
            await sleep(200);
        }

        if (tpl.styles) {
            const styleField = findStylesField();
            if (styleField) {
                setNativeValue(styleField, tpl.styles);
                addLog(`Styles filled.`, '#22c55e');
            } else {
                addLog('Styles field nowhere to be found.', '#f59e0b');
            }
        }

        if (!tpl.lyrics && !tpl.styles) addLog('Template is empty. What the hell did you save?', '#f59e0b');
    }

    function initUpsellBlocker() {
        if (!IS_SUNO) return;
        let checkTimeout;
        const observer = new MutationObserver(() => {
            if (checkTimeout) return;
            checkTimeout = setTimeout(() => {
                checkTimeout = null;
                const modal = document.querySelector('.scrollbar-hide.pointer-events-auto.relative.max-h-[calc(100svh-9rem)]');
                if (!modal) return;
                const text = modal.innerText || '';
                if (text.includes('Out of Credits') || text.includes('Pro Plan') || text.includes('Subscribe')) {
                    if (text.includes('Out of Credits')) { if (spamState.running) stopSpam('out-of-credits'); markCurrentAccountDoneIfOutOfCredits(); }
                    const closeBtn = modal.querySelector('button[aria-label="Close"]');
                    if (closeBtn) closeBtn.click(); else modal.remove();
                }
            }, 300);
        });
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        else waitForBody(() => observer.observe(document.body, { childList: true, subtree: true }));
    }

    function updateDot() { const dot = document.getElementById('snd-dot'); const label = document.getElementById('snd-auth-label'); if (!dot) return; dot.style.background = '#22c55e'; if (label) { label.style.color = '#22c55e'; label.textContent = 'auth ok'; } updateCreditsDisplay(); }
    function setStatus(msg) { const el = document.getElementById('snd-status'); if (el) el.textContent = msg; }
    function clearLog() { const el = document.getElementById('snd-log'); if (el) el.innerHTML = ''; }
    function addLog(msg, color = '#b8956a') {
        const log = document.getElementById('snd-log');
        if (!log) return;
        const d = document.createElement('div');
        d.style.cssText = `color:${color};display:flex;gap:5px;align-items:baseline;`;
        const ts = document.createElement('span');
        ts.style.cssText = 'color:#808080;font-size:10px;flex-shrink:0;font-variant-numeric:tabular-nums;';
        ts.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const text = document.createElement('span');
        text.textContent = msg;
        d.appendChild(ts); d.appendChild(text);
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
    }
    function setProgress(cur, total) { const wrap = document.getElementById('snd-bar-wrap'); const bar = document.getElementById('snd-bar'); if (!wrap || !bar) return; wrap.style.display = 'block'; bar.style.width = `${Math.round((cur / total) * 100)}%`; }
    function sanitizeFilename(name) { return (name || 'track').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80); }

    function stopAutoFlow(reason = 'manual-stop') {
        console.log('[SND] auto flow killed:', reason, getAuto());
        saveAuto({ chainEnabled: true }); reloginInFlight = false;
        const overlay = document.getElementById('snd-overlay'); if (overlay) overlay.remove();
        if (IS_SUNO) { waitForBody(() => { if (!document.getElementById('snd-widget')) setTimeout(createWidget, 200); }); }
    }

    function showPageOverlay(msg) {
        const existing = document.getElementById('snd-overlay');
        const render = (root) => {
            root.innerHTML = '';
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px;';
            const title = document.createElement('span'); title.textContent = 'Suno Auto'; title.style.cssText = 'font-weight:700;color:#C0C0C0;';
            const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Stop'; stop.title = 'Stop auto login and show widget'; stop.style.cssText = 'background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:4px 9px;font-size:12px;cursor:pointer;'; stop.onclick = (e) => { e.preventDefault(); e.stopPropagation(); stopAutoFlow('overlay-stop'); };
            const close = document.createElement('button'); close.type = 'button'; close.textContent = 'X'; close.title = 'Stop auto login and show widget'; close.style.cssText = 'background:transparent;color:#808080;border:none;font-size:16px;line-height:1;cursor:pointer;padding:0 2px;'; close.onclick = (e) => { e.preventDefault(); e.stopPropagation(); stopAutoFlow('overlay-close'); };
            const actions = document.createElement('div'); actions.style.cssText = 'display:flex;align-items:center;gap:5px;'; actions.append(stop, close);
            const body = document.createElement('div'); body.textContent = msg; body.style.cssText = 'white-space:pre-line;font-size:13px;';
            header.append(title, actions); root.append(header, body);
        };
        if (existing) { render(existing); return; }
        const d = Object.assign(document.createElement('div'), { id: 'snd-overlay' });
        d.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;background:#141414;border:1px solid #808080;border-radius:4px;padding:12px 16px;color:#C0C0C0;font-family:"MS Sans Serif",Tahoma,sans-serif;box-shadow:inset 1px 1px 0 rgba(255,255,255,0.08),inset -1px -1px 0 rgba(0,0,0,0.72),0 8px 20px rgba(0,0,0,0.5);white-space:pre-line;width:calc(100vw - 24px);max-width:300px;';
        render(d);
        waitForBody(() => document.body.appendChild(d));
    }

    function initStyles() {
        GM_addStyle(`
            #snd-widget,#snd-widget *{box-sizing:border-box;font-family:"MS Sans Serif",Tahoma,sans-serif;}
            #snd-widget button{cursor:pointer;transition:opacity .15s;}
            #snd-widget button:hover{opacity:.8;}
            #snd-log{max-height:140px;overflow-y:auto;}
            #snd-log::-webkit-scrollbar{width:4px;}
            #snd-log::-webkit-scrollbar-thumb{background:#808080;border-radius:2px;}
            .snd-fmt-inline{font-size:11px;color:#969696;cursor:pointer;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;user-select:none;}
            .snd-fmt-inline input{width:auto;margin:0;cursor:pointer;}
            .snd-tab{flex:1;padding:6px 0;font-size:12px;font-weight:600;border:none;background:transparent;color:#969696;border-bottom:2px solid transparent;cursor:pointer;transition:all .15s;}
            .snd-tab.active{color:#C0C0C0;border-bottom-color:#178CFC;}
            .snd-acc-row{background:#1E1E1E;border-radius:2px;padding:8px 10px;margin-bottom:6px;border:1px solid #808080;transition:box-shadow .2s;}
            .snd-acc-row.dragging{opacity:.6;box-shadow:inset 0 0 0 2px #178CFC;}
            .snd-acc-row.disabled{opacity:.45;}
            .snd-acc-row button{padding:3px 7px;font-size:11px;border:none;border-radius:2px;cursor:pointer;}
            .snd-done-text{text-decoration:line-through;color:#808080;}
            #snd-acc-panel{max-height:390px;overflow-y:auto;}
            #snd-acc-panel::-webkit-scrollbar{width:4px;}
            #snd-acc-panel::-webkit-scrollbar-thumb{background:#808080;border-radius:2px;}
            .snd-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483646;display:flex;align-items:center;justify-content:center;}
            .snd-modal{background:#141414;border:1px solid #808080;border-radius:4px;padding:16px;max-height:90vh;overflow-y:auto;color:#C0C0C0;font-family:"MS Sans Serif",Tahoma,sans-serif;font-size:13px;z-index:2147483647;box-shadow:inset 1px 1px 0 rgba(255,255,255,0.08),inset -1px -1px 0 rgba(0,0,0,0.72),0 24px 72px rgba(0,0,0,0.6);}
            .snd-modal label{display:block;color:#969696;margin-bottom:3px;margin-top:10px;font-size:12px;cursor:help;}
            .snd-modal input,.snd-modal textarea,.snd-modal select{width:100%;background:#0B0B0B;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:6px 8px;font-size:13px;outline:none;}
            .snd-modal textarea{resize:vertical;min-height:60px;}
            .snd-modal input:focus,.snd-modal textarea:focus,.snd-modal select:focus{border-color:#178CFC;}
            .snd-toggle-btn{background:none;border:none;color:#22c55e;font-weight:bold;cursor:pointer;padding:0 4px;font-size:11px;}
            .snd-toggle-btn.off{color:#ef4444;}
            #snd-panel-tpl{max-height:390px;overflow-y:auto;}
            #snd-panel-tpl::-webkit-scrollbar{width:4px;}
            #snd-panel-tpl::-webkit-scrollbar-thumb{background:#808080;border-radius:2px;}
            .snd-section-title{font-size:13px;font-weight:600;color:#C0C0C0;margin:12px 0 8px 0;border-bottom:1px solid #808080;padding-bottom:4px;cursor:default;}
            #snd-widget input[type="number"]{background:#0B0B0B;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:3px 5px;font-size:11px;text-align:center;}
            #snd-widget input[type="number"]:focus{border-color:#178CFC;}
            .snd-archive-toggle{background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:4px 8px;font-size:11px;cursor:pointer;}
            .snd-archive-toggle.active{background:#178CFC;color:#fff;border-color:#178CFC;}
            label[title]{cursor:help;}
            .snd-btn-group{display:flex;gap:4px;margin-top:2px;}
            .snd-btn-opt{flex:1;background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:6px 4px;font-size:12px;cursor:pointer;transition:all .15s;font-weight:500;text-align:center;}
            .snd-btn-opt.active{background:#178CFC;color:#fff;border-color:#178CFC;font-weight:700;}
            .snd-btn-opt:hover:not(.active){border-color:#C0C0C0;color:#C0C0C0;background:#202020;}
            #snd-body{cursor:grab;}
            #snd-body input,#snd-body button,#snd-body textarea,#snd-body select,#snd-body label,#snd-acc-panel,#snd-tpl-list,#snd-panel-tags,#snd-log{cursor:default;}
            .snd-voice-m{color:#60a5fa;font-weight:700;}
            .snd-voice-f{color:#f472b6;font-weight:700;}
            .snd-modal .sm-top-label{font-size:13px!important;color:#969696;margin-top:10px;margin-bottom:3px;cursor:help;}
            .snd-modal .sm-top-section>.sm-top-label:first-child{margin-top:0;}
            .snd-modal .sm-top-input{width:100%;background:#0B0B0B;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:6px 8px;font-size:13px;outline:none;}
            .snd-modal .sm-top-input:focus{border-color:#178CFC;}
            .snd-btn-group-sm .snd-btn-opt{padding:4px;font-size:11px;}
            .snd-tpl-pick-btn{background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:3px 8px;font-size:11px;cursor:pointer;font-weight:600;white-space:nowrap;transition:all .15s;flex-shrink:0;}
            .snd-tpl-pick-btn:hover{background:#202020;border-color:#C0C0C0;}
            .snd-tpl-popover::-webkit-scrollbar{width:4px;}
            .snd-tpl-popover::-webkit-scrollbar-thumb{background:#808080;border-radius:2px;}
        `);
    }

    function createWidget() {
        if (!document.body) { waitForBody(createWidget); return; }
        if (document.getElementById('snd-widget')) return;
        initStyles();

        const w = document.createElement('div');
        w.id = 'snd-widget';
        const savedPos = GM_getValue('snd_widget_pos', { right: '16px', bottom: '16px' });
        w.style.cssText = `position:fixed;${savedPos.right ? `right:${savedPos.right};` : ''}${savedPos.bottom ? `bottom:${savedPos.bottom};` : ''}${savedPos.left ? `left:${savedPos.left};` : ''}${savedPos.top ? `top:${savedPos.top};` : ''}z-index:2147483647;width:380px;max-width:95vw;background:#141414;border:1px solid #808080;border-radius:4px;box-shadow:inset 1px 1px 0 rgba(255,255,255,0.08),inset -1px -1px 0 rgba(0,0,0,0.72),0 8px 20px rgba(0,0,0,0.5);color:#C0C0C0;font-family:"MS Sans Serif",Tahoma,sans-serif;transition:height .2s;`;
        w.innerHTML = `
        <div id="snd-header" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#1E1E1E;border-bottom:1px solid #202020;border-radius:4px 4px 0 0;cursor:move;">
          <span style="color:#C0C0C0;font-weight:700;font-size:14px;font-family:Tahoma,sans-serif;user-select:none;">Suno DL</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="snd-auth-label" style="font-size:11px;color:#800000;">no auth</span>
            <span id="snd-dot" style="width:8px;height:8px;border-radius:50%;background:#800000;display:inline-block;flex-shrink:0;"></span>
            <button id="snd-opacity-btn" title="Cycle opacity" style="background:#1E1E1E;border:1px solid #808080;color:#C0C0C0;font-family:Tahoma,sans-serif;font-size:10px;font-weight:700;border-radius:2px;padding:2px 6px;">100%</button>
            <button id="snd-collapse-btn" title="Collapse/Expand" style="background:none;border:none;color:#C0C0C0;font-size:16px;line-height:1;cursor:pointer;padding:0 2px;">V</button>
          </div>
        </div>
        <div id="snd-body" style="${widgetCollapsed ? 'display:none;' : ''}">
          <div style="display:flex;gap:0;padding:8px 12px 0;border-bottom:1px solid #202020;">
            <button class="snd-tab active" id="snd-tab-main">Main</button>
            <button class="snd-tab" id="snd-tab-tpl">Templates</button>
            <button class="snd-tab" id="snd-tab-tags">Tags</button>
          </div>
          <div id="snd-panel-main" style="padding:12px;">
            <div style="display:flex;gap:6px;margin-bottom:8px;">
              <button id="snd-spam-toggle" style="flex:1;background:#178CFC;color:#fff;border:1px solid #178CFC;border-radius:2px;padding:6px 0;font-size:12px;font-weight:600;">Start Spam</button>
              <button id="snd-spam-save" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:6px 8px;font-size:12px;">Save</button>
            </div>
            <div id="snd-spam-section" style="padding:8px;background:#1E1E1E;border:1px solid #202020;border-radius:2px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-size:11px;color:#969696;font-weight:600;">Profile:</span>
                <button id="snd-profile-a" style="background:#178CFC;color:#fff;border:1px solid #178CFC;border-radius:2px;padding:2px 10px;font-size:11px;font-weight:700;">A</button>
                <button id="snd-profile-b" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:2px 10px;font-size:11px;font-weight:600;">B</button>
                <span id="snd-profile-indicator" style="font-size:10px;color:#808080;margin-left:auto;">Active: A</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <input type="checkbox" id="snd-auto-spam-fresh" style="width:auto;"/>
                <label for="snd-auto-spam-fresh" style="margin:0;font-size:11px;color:#969696;cursor:pointer;" title="Auto-start spam on fresh credits (>=45)">Auto-spam fresh</label>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
                <label style="font-size:11px;color:#969696;">Burst</label><input id="snd-burst-size" type="number" min="1" max="50" value="5" style="width:40px;">
                <label style="font-size:11px;color:#969696;">Int(ms)</label><input id="snd-burst-interval" type="number" min="10" max="2000" value="75" style="width:48px;">
                <label style="font-size:11px;color:#969696;">B-Int</label><input id="snd-burst-group-interval" type="number" min="0" max="60000" value="500" style="width:52px;">
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <label style="font-size:11px;color:#969696;">Bursts</label><input id="snd-bursts-per-group" type="number" min="1" max="999" value="2" style="width:44px;">
                <label style="font-size:11px;color:#969696;">Cool(s)</label><input id="snd-cooldown" type="number" min="1" max="3600" value="60" style="width:48px;">
                <label style="font-size:11px;color:#969696;">Repeat</label><input id="snd-total-groups" type="number" min="1" max="999" value="999" style="width:48px;">
                <span id="snd-spam-status" style="font-size:11px;color:#808080;margin-left:6px;">Ready</span>
              </div>
              <div id="snd-credits" style="font-size:11px;color:#178CFC;margin-top:4px;font-weight:bold;">Credits: ?</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
              <label style="font-size:12px;color:#969696;">Last</label><input id="snd-n" type="number" min="1" max="200" value="10" style="width:48px;">
              <label style="font-size:12px;color:#969696;">tracks</label>
              <label class="snd-fmt-inline" title="MP3"><input type="radio" name="snd-fmt" id="snd-fmt-mp3" value="mp3" checked> mp3</label>
              <label class="snd-fmt-inline" title="WAV"><input type="radio" name="snd-fmt" id="snd-fmt-wav" value="wav"> wav</label>
              <button id="snd-go" style="flex:1;min-width:60px;background:#178CFC;color:#fff;border:1px solid #178CFC;border-radius:2px;padding:6px 0;font-size:12px;">Download</button>
              <button id="snd-cancel" style="background:#800000;color:#fff;border:1px solid #800000;border-radius:2px;padding:6px 8px;font-size:12px;">X</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <input type="checkbox" id="snd-wait-gen" checked style="width:auto;"/>
              <label for="snd-wait-gen" style="margin:0;color:#C0C0C0;font-size:12px;">Wait gen</label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <input type="checkbox" id="snd-auto-next" checked style="width:auto;"/>
              <label for="snd-auto-next" style="margin:0;color:#C0C0C0;font-size:12px;">Auto next 0 credits</label>
            </div>
            <div id="snd-bar-wrap" style="background:#202020;border-radius:2px;height:4px;margin-bottom:8px;overflow:hidden;display:none;">
              <div id="snd-bar" style="height:100%;width:0%;background:#178CFC;border-radius:2px;transition:width 180ms;"></div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <div id="snd-status" style="font-size:12px;color:#969696;flex:1;min-height:16px;">Waiting...</div>
              <button id="snd-clear-log" title="Clear log" style="background:none;border:none;color:#808080;font-size:12px;cursor:pointer;padding:0 4px;">Del</button>
            </div>
            <div id="snd-log" style="font-size:11px;color:#969696;line-height:1.6;margin-bottom:12px;max-height:140px;overflow-y:auto;"></div>

            <div class="snd-section-title" style="display:flex; justify-content:space-between; align-items:baseline;">
              <span>Accounts & Data</span>
              <div style="display:flex; gap:6px;">
                <button id="snd-export-btn" title="Backup EVERY damn thing to a JSON file" style="background:#1E1E1E;color:#22c55e;border:1px solid #808080;border-radius:2px;padding:2px 8px;font-size:10px;cursor:pointer;">Export All</button>
                <button id="snd-import-btn" title="Restore EVERYTHING from a JSON file" style="background:#1E1E1E;color:#f59e0b;border:1px solid #808080;border-radius:2px;padding:2px 8px;font-size:10px;cursor:pointer;">Import All</button>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <button id="snd-reset-done" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:4px 8px;font-size:11px;">Reset done</button>
              <button id="snd-archive-toggle" class="snd-archive-toggle" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:4px 8px;font-size:11px;">Show archive</button>
            </div>
            <div id="snd-acc-panel" style="max-height:330px;overflow-y:auto;margin-bottom:8px;"></div>
            <button id="snd-add-acc" style="width:100%;background:#1E1E1E;color:#178CFC;border:1px dashed #808080;border-radius:2px;padding:6px 0;font-size:12px;">+ Add Account</button>
          </div>
          <div id="snd-panel-tpl" style="padding:12px;display:none;">
            <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
              <button id="snd-add-tpl" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:4px 12px;font-size:11px;">+ New</button>
            </div>
            <div id="snd-tpl-list" style="max-height:340px;overflow-y:auto;"></div>
          </div>
          <div id="snd-panel-tags" style="padding:12px;display:none;overflow-y:auto;max-height:520px;"></div>
        </div>`;
        document.body.appendChild(w);

        const PROFILE_STYLE_ACTIVE = 'background:#178CFC;color:#fff;border:1px solid #178CFC;border-radius:2px;padding:2px 10px;font-size:11px;font-weight:700;';
        const PROFILE_STYLE_IDLE = 'background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:2px 10px;font-size:11px;font-weight:600;';

        function readSpamInputs() {
            return {
                burstSize: parseInt(document.getElementById('snd-burst-size').value) || 5,
                burstInterval: parseInt(document.getElementById('snd-burst-interval').value) || 75,
                burstGroupInterval: parseInt(document.getElementById('snd-burst-group-interval').value) || 500,
                burstsPerGroup: parseInt(document.getElementById('snd-bursts-per-group').value) || 2,
                cooldown: parseInt(document.getElementById('snd-cooldown').value) || 60,
                totalGroups: parseInt(document.getElementById('snd-total-groups').value) || 999
            };
        }

        function applySpamInputs(s) {
            if (!s || !Object.keys(s).length) return;
            if (s.burstSize) document.getElementById('snd-burst-size').value = s.burstSize;
            if (s.burstInterval) document.getElementById('snd-burst-interval').value = s.burstInterval;
            if (s.burstGroupInterval !== undefined) document.getElementById('snd-burst-group-interval').value = s.burstGroupInterval;
            if (s.burstsPerGroup) document.getElementById('snd-bursts-per-group').value = s.burstsPerGroup;
            if (s.cooldown) document.getElementById('snd-cooldown').value = s.cooldown;
            if (s.totalGroups) document.getElementById('snd-total-groups').value = s.totalGroups;
        }

        function refreshProfileButtons(active) {
            document.getElementById('snd-profile-a').style.cssText = active === 'A' ? PROFILE_STYLE_ACTIVE : PROFILE_STYLE_IDLE;
            document.getElementById('snd-profile-b').style.cssText = active === 'B' ? PROFILE_STYLE_ACTIVE : PROFILE_STYLE_IDLE;
            document.getElementById('snd-profile-indicator').textContent = 'Active: ' + active;
        }

        function switchProfile(newProfile) {
            const cur = getActiveProfile();
            if (cur === newProfile) return;
            const profiles = getSpamProfiles();
            profiles[cur] = readSpamInputs();
            saveSpamProfiles(profiles);
            setActiveProfile(newProfile);
            refreshProfileButtons(newProfile);
            const newData = getSpamProfiles()[newProfile];
            if (newData) applySpamInputs(newData);
            addLog(`Switched to Profile ${newProfile}`, '#d4a574');
        }

        document.getElementById('snd-profile-a').onclick = () => switchProfile('A');
        document.getElementById('snd-profile-b').onclick = () => switchProfile('B');

        const _activeProfile = getActiveProfile();
        refreshProfileButtons(_activeProfile);
        const spamSaved = getSpamSettings();
        applySpamInputs(spamSaved);

        const autoSpamFresh = document.getElementById('snd-auto-spam-fresh');
        if (autoSpamFresh) {
            autoSpamFresh.checked = GM_getValue('snd_auto_spam_fresh', false);
            autoSpamFresh.onchange = () => GM_setValue('snd_auto_spam_fresh', autoSpamFresh.checked);
        }

        const wgBtn = document.getElementById('snd-wait-gen');
        if (wgBtn) {
            wgBtn.checked = GM_getValue('snd_wait_gen', true);
            wgBtn.onchange = () => GM_setValue('snd_wait_gen', wgBtn.checked);
        }
        const anBtn = document.getElementById('snd-auto-next');
        if (anBtn) {
            anBtn.checked = GM_getValue('snd_auto_next', true);
            anBtn.onchange = () => GM_setValue('snd_auto_next', anBtn.checked);
        }

        let collapsed = widgetCollapsed;
        const bodyEl = document.getElementById('snd-body');
        document.getElementById('snd-collapse-btn').onclick = () => { collapsed = !collapsed; bodyEl.style.display = collapsed ? 'none' : ''; document.getElementById('snd-collapse-btn').textContent = collapsed ? 'V' : 'A'; GM_setValue('snd_widget_collapsed', collapsed); };

        const OPACITY_CYCLE = ['100', '50', '25'];
        let currentOpacity = GM_getValue('snd_widget_opacity', '100');
        if (!OPACITY_CYCLE.includes(currentOpacity)) currentOpacity = '100';
        const applyOpacity = (val) => {
            currentOpacity = val;
            GM_setValue('snd_widget_opacity', val);
            w.style.opacity = val === '100' ? '1' : val === '50' ? '0.5' : '0.25';
            w.style.transition = 'opacity 0.2s';
            const btn = document.getElementById('snd-opacity-btn');
            if (btn) btn.textContent = val + '%';
        };
        applyOpacity(currentOpacity);
        document.getElementById('snd-opacity-btn').onclick = () => {
            const idx = OPACITY_CYCLE.indexOf(currentOpacity);
            applyOpacity(OPACITY_CYCLE[(idx + 1) % OPACITY_CYCLE.length]);
        };
        document.getElementById('snd-opacity-btn').addEventListener('mouseenter', () => { document.getElementById('snd-opacity-btn').style.background = '#202020'; document.getElementById('snd-opacity-btn').style.borderColor = '#C0C0C0'; document.getElementById('snd-opacity-btn').style.color = '#fff'; });
        document.getElementById('snd-opacity-btn').addEventListener('mouseleave', () => { document.getElementById('snd-opacity-btn').style.background = '#1E1E1E'; document.getElementById('snd-opacity-btn').style.borderColor = '#808080'; document.getElementById('snd-opacity-btn').style.color = '#C0C0C0'; });

        w.addEventListener('mouseenter', () => {
            if (currentOpacity !== '100') w.style.opacity = '1';
        });
        w.addEventListener('mouseleave', () => {
            if (currentOpacity !== '100') w.style.opacity = currentOpacity === '50' ? '0.5' : '0.25';
        });

        w._getFormat = () => {
            const checked = document.querySelector('input[name="snd-fmt"]:checked');
            return checked ? checked.value : 'mp3';
        };

        const tabMain = document.getElementById('snd-tab-main');
        const tabTpl  = document.getElementById('snd-tab-tpl');
        const tabTags = document.getElementById('snd-tab-tags');
        const panelMain = document.getElementById('snd-panel-main');
        const panelTpl  = document.getElementById('snd-panel-tpl');
        const panelTags = document.getElementById('snd-panel-tags');
        function switchTab(active) {
            [tabMain, tabTpl, tabTags].forEach(t => t.classList.remove('active'));
            [panelMain, panelTpl, panelTags].forEach(p => { p.style.display = 'none'; });
            active.tab.classList.add('active');
            active.panel.style.display = '';
            if (active.onShow) active.onShow();
        }
        tabMain.onclick = () => switchTab({ tab: tabMain, panel: panelMain, onShow: renderAccounts });
        tabTpl.onclick  = () => switchTab({ tab: tabTpl,  panel: panelTpl,  onShow: renderTemplatesPanel });
        tabTags.onclick = () => switchTab({ tab: tabTags, panel: panelTags, onShow: renderTagsPanel });

        const auto = getAuto();
        saveAuto({ ...auto, chainEnabled: true });

        document.getElementById('snd-reset-done').onclick = () => { const accounts = getAccounts(); accounts.forEach(a => a.done = false); saveAccounts(accounts); renderAccounts(); };
        document.getElementById('snd-add-tpl').onclick = () => openTemplateModal(null);
        document.getElementById('snd-go').onclick = () => startDownload();
        document.getElementById('snd-cancel').onclick = () => { cancelRequested = true; setStatus('Cancelling, hold your horses...'); };
        document.getElementById('snd-spam-toggle').onclick = () => { if (spamState.running) stopSpam('manual'); else startSpam(); };
        document.getElementById('snd-spam-save').onclick = () => {
            const settings = readSpamInputs();
            saveSpamSettings(settings);
            const ap = getActiveProfile();
            addLog(`Profile ${ap} saved, stop messing with it.`, '#22c55e');
            setStatus(`Profile ${ap} saved!`);
        };
        document.getElementById('snd-add-acc').onclick = () => openAccountModal(null);
        document.getElementById('snd-clear-log').onclick = clearLog;
        document.getElementById('snd-export-btn').onclick = exportWarriorData;
        document.getElementById('snd-import-btn').onclick = importWarriorData;

        let showArchive = false;
        document.getElementById('snd-archive-toggle').onclick = () => {
            showArchive = !showArchive;
            const btn = document.getElementById('snd-archive-toggle');
            btn.classList.toggle('active');
            btn.textContent = showArchive ? 'Hide archive' : 'Show archive';
            renderAccounts();
        };

        if (capturedAuth) updateDot(); else tryGrabClerkToken();
        const poll = setInterval(() => { if (capturedAuth) { clearInterval(poll); return; } tryGrabClerkToken(); }, 2000);

        let drag = false, ox = 0, oy = 0, wRect = null, isTicking = false;

        function clampWidgetToViewport() {
            try {
                const rect = w.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const ww = rect.width || w.offsetWidth || 380;
                const wh = rect.height || w.offsetHeight || 200;
                const minMargin = 8;

                let curLeft = parseFloat(w.style.left);
                let curTop = parseFloat(w.style.top);
                const usingLeft = !isNaN(curLeft) && w.style.right === 'auto';
                const usingRight = !usingLeft && w.style.right && w.style.right !== 'auto';

                let newLeft, newTop;

                if (usingLeft || (!usingLeft && !usingRight)) {
                    if (isNaN(curLeft)) curLeft = vw - ww - 16;
                    newLeft = Math.min(Math.max(curLeft, minMargin), vw - ww - minMargin);
                } else {
                    const curRight = parseFloat(w.style.right);
                    const rightPx = isNaN(curRight) ? 16 : curRight;
                    newLeft = vw - ww - Math.max(rightPx, minMargin);
                    newLeft = Math.max(newLeft, minMargin);
                }

                if (isNaN(curTop)) {
                    const curBottom = parseFloat(w.style.bottom);
                    if (!isNaN(curBottom)) {
                        curTop = vh - wh - curBottom;
                    } else {
                        curTop = vh - wh - 16;
                    }
                }
                newTop = Math.min(Math.max(curTop, minMargin), vh - wh - minMargin);
                newTop = Math.max(newTop, minMargin);

                w.style.left = `${newLeft}px`;
                w.style.top = `${newTop}px`;
                w.style.right = 'auto';
                w.style.bottom = 'auto';
            } catch (e) { }
        }

        window.addEventListener('resize', () => {
            if (!document.getElementById('snd-widget')) return;
            clampWidgetToViewport();
            const pos = { left: w.style.left, top: w.style.top, right: 'auto', bottom: 'auto' };
            GM_setValue('snd_widget_pos', pos);
        });

        w.addEventListener('mousedown', e => {
            if (e.target.closest('input, button, textarea, select, label, a, [role="button"]')) return;
            if (e.target.closest('#snd-acc-panel, #snd-tpl-list, #snd-panel-tags')) return;
            drag = true; wRect = w.getBoundingClientRect();
            ox = e.clientX - w.offsetLeft; oy = e.clientY - w.offsetTop;
            w.style.transition = 'none';
            w.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!drag) return;
            if (!isTicking) {
                window.requestAnimationFrame(() => {
                    let newX = e.clientX - ox;
                    let newY = e.clientY - oy;
                    const margin = 8;
                    const ww = wRect ? wRect.width : w.offsetWidth;
                    const wh = wRect ? wRect.height : w.offsetHeight;
                    newX = Math.max(margin, Math.min(newX, window.innerWidth - ww - margin));
                    newY = Math.max(margin, Math.min(newY, window.innerHeight - wh - margin));
                    w.style.left = `${newX}px`;
                    w.style.top = `${newY}px`;
                    w.style.right = 'auto';
                    w.style.bottom = 'auto';
                    isTicking = false;
                });
                isTicking = true;
            }
        });
        document.addEventListener('mouseup', () => {
            if (!drag) return;
            drag = false;
            w.style.transition = 'height 0.2s, opacity 0.2s';
            w.style.userSelect = '';
            clampWidgetToViewport();
            const pos = { left: w.style.left, top: w.style.top, right: 'auto', bottom: 'auto' };
            GM_setValue('snd_widget_pos', pos);
        });

        requestAnimationFrame(() => clampWidgetToViewport());

        ['snd-burst-size', 'snd-burst-interval', 'snd-burst-group-interval', 'snd-bursts-per-group', 'snd-cooldown', 'snd-total-groups'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                let timeout;
                el.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => { const val = parseInt(el.value) || 1; el.value = val; }, 300);
                });
            }
        });

        const autoState = getAuto();
        if ((autoState.active || autoState.pendingLogin) && autoState.step === 'login_pending' && autoState.oauthVisited) completeOAuthLogin();
        if (autoState.step === 'post_login' && isSunoCreatePath()) completeOAuthLogin();

        installWidgetGuard();
        initUpsellBlocker();
        renderAccounts();
    }

    function renderTagsPanel() {
        const panel = document.getElementById('snd-panel-tags');
        if (!panel) return;
        const T = getTagSettings();
        const now = new Date();
        const autoYear  = String(now.getFullYear());
        const autoMonth = String(now.getMonth() + 1).padStart(2, '0');

        const field = (label, key, value, hint, type='text') => `
            <div style="margin-bottom:8px;">
                <label style="font-size:11px;color:#969696;display:block;margin-bottom:2px;" title="${hint||''}">${label}</label>
                <input type="${type}" data-tagkey="${key}" value="${parseHtml(String(value||''))}"
                    style="width:100%;background:#0B0B0B;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:5px 7px;font-size:12px;box-sizing:border-box;"/>
            </div>`;
        const textarea = (label, key, value, hint, rows=2) => `
            <div style="margin-bottom:8px;">
                <label style="font-size:11px;color:#969696;display:block;margin-bottom:2px;" title="${hint||''}">${label}</label>
                <textarea data-tagkey="${key}" rows="${rows}"
                    style="width:100%;background:#0B0B0B;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:5px 7px;font-size:12px;resize:vertical;box-sizing:border-box;">${parseHtml(String(value||''))}</textarea>
            </div>`;
        const sect = (title) => `<div style="font-size:11px;font-weight:700;color:#808080;text-transform:uppercase;letter-spacing:1px;margin:12px 0 6px;border-bottom:1px solid #2a2a2a;padding-bottom:3px;">${title}</div>`;
        const yearLocked = T._year_locked || false;

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-size:13px;font-weight:700;color:#C0C0C0;">ID3 Tag Settings</span>
                <div style="display:flex;gap:6px;">
                    <button id="snd-tags-reset" style="background:#1E1E1E;color:#f59e0b;border:1px solid #808080;border-radius:2px;padding:3px 8px;font-size:11px;cursor:pointer;">Reset</button>
                    <button id="snd-tags-save" style="background:#178CFC;color:#fff;border:none;border-radius:2px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;">Save</button>
                </div>
            </div>
            <div style="background:#1a1a0a;border:1px solid #444;border-radius:2px;padding:6px 8px;margin-bottom:10px;font-size:11px;color:#c9a13a;">
                ⚡ Year &amp; Month auto-update every session.
                <label style="margin-left:8px;cursor:pointer;color:#C0C0C0;">
                    <input type="checkbox" id="snd-tags-yearlock" ${yearLocked?'checked':''} style="width:auto;vertical-align:middle;margin-right:3px;"/>
                    Lock year/month
                </label>
            </div>
            ${sect('Artists')}
            ${field('Artist (TPE1)', 'artist', T.artist, 'Main performer — e.g. potatoddas')}
            ${field('Album Artist (TPE2)', 'album_artist', T.album_artist, 'Album-level artist for compilations')}
            ${field('Composer (TCOM)', 'composer', T.composer, 'Music composer')}
            ${field('Lyricist (TEXT)', 'lyricist', T.lyricist, 'Lyrics writer')}
            ${field('Original Artist (TOPE)', 'original_artist', T.original_artist, 'Original performer if cover')}
            ${field('Conductor (TPE3)', 'conductor', T.conductor)}
            ${field('Remixer (TPE4)', 'remixer', T.remixer)}
            ${sect('Album / Release')}
            ${field('Album (TALB)', 'album', T.album)}
            ${field('Disc No (TPOS)', 'disc', T.disc, 'e.g. 1')}
            ${field('Disc Total', 'disc_total', T.disc_total, 'e.g. 2 → writes "1/2"')}
            ${sect('Date — Auto-updated each session')}
            ${field('Year (TYER)', 'year', yearLocked ? T.year : autoYear, 'Current year auto-filled')}
            ${field('Month (TDRC)', 'date', yearLocked ? T.date : autoMonth, 'Current month (01–12) auto-filled')}
            ${field('Original Year (TORY)', 'original_year', yearLocked ? T.original_year : autoYear)}
            ${sect('Genre / Mood')}
            ${field('Genre (TCON)', 'genre', T.genre)}
            ${field('Mood (TMOO)', 'mood', T.mood)}
            ${sect('Rights / Publishing')}
            ${field('Copyright (TCOP)', 'copyright', T.copyright)}
            ${field('Publisher (TPUB)', 'publisher', T.publisher)}
            ${field('Encoded By (TENC)', 'encoded_by', T.encoded_by)}
            ${field('Encoding Tool (TSSE)', 'encoding_tool', T.encoding_tool)}
            ${field('ISRC (TSRC)', 'isrc', T.isrc)}
            ${sect('Comment / Lyrics Tag')}
            ${textarea('Comment (COMM)', 'comment', T.comment, 'Embedded comment tag', 4)}
            ${sect('URLs')}
            ${field('Artist URL (WOAR)', 'url_artist', T.url_artist)}
            ${field('Custom URL (WXXX)', 'url', T.url)}
            ${field('Audio Source (WOAS)', 'url_audio_source', T.url_audio_source)}
            ${field('Publisher URL (WPUB)', 'url_publisher', T.url_publisher)}
            ${sect('BPM / Key / Language')}
            ${field('BPM (TBPM)', 'bpm', T.bpm, 'Beats per minute', 'number')}
            ${field('Key (TKEY)', 'key', T.key, 'Musical key e.g. Cm')}
            ${field('Language (TLAN)', 'language', T.language, 'ISO 639-2 code e.g. rus, eng')}
        `;

        document.getElementById('snd-tags-save').onclick = () => {
            const saved = {};
            panel.querySelectorAll('[data-tagkey]').forEach(el => {
                saved[el.dataset.tagkey] = el.value;
            });
            saved._year_locked = document.getElementById('snd-tags-yearlock').checked;
            saveTagSettings(saved);
            addLog('Tags saved. All downloads will use these from now.', '#22c55e');
            // Flash button feedback
            const btn = document.getElementById('snd-tags-save');
            if (btn) { const orig = btn.textContent; btn.textContent = 'Saved!'; setTimeout(() => { btn.textContent = orig; }, 1200); }
        };

        document.getElementById('snd-tags-reset').onclick = () => {
            if (!confirm('Reset ALL tags to defaults?')) return;
            GM_setValue('snd_tag_settings', 'null');
            renderTagsPanel();
            addLog('Tags reset to defaults.', '#f59e0b');
        };

        document.getElementById('snd-tags-yearlock').onchange = (e) => {
            const cur = getTagSettings();
            cur._year_locked = e.target.checked;
            saveTagSettings(cur);
            renderTagsPanel();
        };
    }

    function renderAccounts() {
        const panel = document.getElementById('snd-acc-panel');
        if (!panel) return;
        const accounts = getAccounts();
        const showArchive = document.getElementById('snd-archive-toggle')?.classList.contains('active') || false;

        const withIndex = accounts
            .map((acc, originalIdx) => ({ ...acc, originalIdx }))
            .filter(item => showArchive ? true : !item.done);

        panel.innerHTML = '';
        if (!withIndex.length) {
            panel.innerHTML = `<div style="color:#808080;font-size:12px;text-align:center;padding:12px 0;">${showArchive ? 'No archived accounts.' : 'No active accounts. Add one already!'}</div>`;
            return;
        }

        if (!panel._sndDelegated) {
            panel._sndDelegated = true;
            panel.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const action = btn.getAttribute('data-action');
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (isNaN(idx)) return;
                e.stopPropagation();
                switch (action) {
                    case 'login': loginAccount(idx); break;
                    case 'fill': {
                        const acc = getAccounts()[idx];
                        if (acc) { if (isSunoCreatePath()) fillSunoForm(acc); else goToCreate('fill-request'); }
                        break;
                    }
                    case 'edit': openAccountModal(idx); break;
                    case 'delete': if (!confirm('You sure you want to trash this account?')) return; const arr = getAccounts(); arr.splice(idx, 1); saveAccounts(arr); renderAccounts(); break;
                    case 'toggle': toggleAccountEnabled(idx); break;
                }
            });
        }

        let draggedIdx = null, draggedEl = null, dragTicking = false;
        withIndex.forEach((item) => {
            const acc = item;
            const idx = acc.originalIdx;
            const row = document.createElement('div');
            row.className = 'snd-acc-row' + (acc.enabled ? '' : ' disabled');
            row.setAttribute('data-original-idx', idx);

            let editColorStyle = '';
            let editColorTitle = '';
            if (acc.lastEdited) {
                const diff = Date.now() - acc.lastEdited;
                if (diff < 60000) { editColorStyle = 'border-left: 4px solid #ef4444;'; editColorTitle = 'Edited just now [< 1 min]'; }
                else if (diff < 3600000) { editColorStyle = 'border-left: 4px solid #f97316;'; editColorTitle = 'Edited last hour'; }
                else if (diff < 86400000) { editColorStyle = 'border-left: 4px solid #3b82f6;'; editColorTitle = 'Edited last 24H'; }
            }

            row.style.cssText = `display:flex;align-items:center;gap:4px;${editColorStyle}`;
            if (editColorTitle) row.title = editColorTitle;

            const doneChk = document.createElement('input');
            doneChk.type = 'checkbox';
            doneChk.checked = !!acc.done;
            doneChk.title = 'Mark as done (archive)';
            doneChk.style.cssText = 'width:auto;cursor:pointer;';
            doneChk.onclick = (e) => {
                e.stopPropagation();
                const arr = getAccounts();
                arr[idx].done = doneChk.checked;
                saveAccounts(arr);
                renderAccounts();
            };

            const handle = document.createElement('span');
            handle.textContent = 'M';
            handle.title = 'Drag to reorder';
            handle.style.cssText = 'cursor:grab;color:#808080;font-size:16px;user-select:none;padding:0 4px;';
            handle.onmousedown = (e) => {
                e.preventDefault();
                draggedIdx = idx;
                draggedEl = row;
                row.classList.add('dragging');
                document.addEventListener('mousemove', onDragOver);
                document.addEventListener('mouseup', onDragEnd);
            };

            const content = document.createElement('div');
            content.style.cssText = 'flex:1;min-width:0;';
            const nameDisplay = acc.name || acc.email;
            const nameClass = acc.done ? 'snd-done-text' : '';
            content.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:14px;">${acc.provider === 'google' ? 'G' : 'M'}</span>
                        <span class="${nameClass}" style="font-size:12px;font-weight:600;color:#C0C0C0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${parseHtml(acc.email)}">${parseHtml(nameDisplay)}</span>
                    </div>
                    <div style="display:flex;gap:4px;align-items:center;">
                        <button data-action="login" data-idx="${idx}" title="Login as this account" style="background:#1E1E1E;color:#C0C0C0;font-size:10px;padding:3px 6px;">Login</button>
                        <button data-action="fill" data-idx="${idx}" title="Fill create form from this account" style="background:#1E1E1E;color:#C0C0C0;font-size:10px;padding:3px 6px;">Fill</button>
                        <button data-action="edit" data-idx="${idx}" title="Edit account" style="background:#1E1E1E;color:#C0C0C0;font-size:10px;padding:3px 6px;">Edit</button>
                        <button data-action="delete" data-idx="${idx}" title="Delete" style="background:#800000;color:#fff;font-size:10px;padding:3px 6px;">Del</button>
                        <button data-action="toggle" data-idx="${idx}" class="snd-toggle-btn ${acc.enabled ? '' : 'off'}" title="Toggle enabled/disabled">${acc.enabled ? 'ON' : 'OFF'}</button>
                    </div>
                </div>
                <div style="font-size:11px;color:#969696;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <span>${parseHtml(acc.email)}</span>
                    <span>${(acc.format || 'mp3').toUpperCase()}</span>
                    ${acc.voice && acc.voice !== 'none' ? `<span class="${acc.voice === 'male' ? 'snd-voice-m' : 'snd-voice-f'}">${acc.voice === 'male' ? 'M' : 'F'}</span>` : ''}
                    ${acc.autoFill ? '<span style="color:#178CFC;">form</span>' : ''}
                    ${acc.songName ? `<span style="color:#C0C0C0;" title="Song name">${parseHtml(acc.songName)}</span>` : ''}
                    ${acc.password ? '<span style="color:#4ade80;">pwd</span>' : ''}
                </div>
                ${(() => {
                    const ledStr = fmtLastEdited(acc.lastEdited);
                    const tpls = getTemplates();
                    const stylesMatch = acc.styles ? tpls.find(t => t.styles && t.styles === acc.styles) : null;
                    const stylesLabel = stylesMatch ? parseHtml(stylesMatch.name) : '';
                    if (!ledStr && !stylesLabel) return '';
                    return `<div style="font-size:10px;color:#808080;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:2px;">${ledStr ? `<span title="Last edited">${ledStr}</span>` : ''}${stylesLabel ? `<span style="color:#808080;" title="Styles preset">&#9834;&nbsp;${stylesLabel}</span>` : ''}</div>`;
                })()}
            `;

            row.appendChild(doneChk);
            row.appendChild(handle);
            row.appendChild(content);
            panel.appendChild(row);
        });

        const onDragOver = (e) => {
            if (!draggedEl) return;
            if (!dragTicking) {
                window.requestAnimationFrame(() => {
                    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.snd-acc-row');
                    if (target && target !== draggedEl) {
                        const targetIdx = parseInt(target.getAttribute('data-original-idx'), 10);
                        if (!isNaN(targetIdx) && targetIdx !== draggedIdx) {
                            const arr = getAccounts();
                            const moved = arr.splice(draggedIdx, 1)[0];
                            arr.splice(targetIdx, 0, moved);
                            saveAccounts(arr);
                            draggedIdx = targetIdx;
                            renderAccounts();
                        }
                    }
                    dragTicking = false;
                });
                dragTicking = true;
            }
        };

        const onDragEnd = () => {
            document.removeEventListener('mousemove', onDragOver);
            document.removeEventListener('mouseup', onDragEnd);
            if (draggedEl) draggedEl.classList.remove('dragging');
            draggedIdx = null;
            draggedEl = null;
        };
    }

    function showTemplatePicker(btn, fieldId, type) {
        document.querySelector('.snd-tpl-popover')?.remove();
        const templates = getTemplates();
        const filtered = templates.filter(t => type === 'lyrics' ? !!t.lyrics : !!t.styles);
        if (!filtered.length) { addLog('No ' + type + ' templates saved yet.', '#f59e0b'); return; }
        const popover = document.createElement('div');
        popover.className = 'snd-tpl-popover';
        const btnRect = btn.getBoundingClientRect();
        popover.style.cssText = 'position:fixed;top:' + (btnRect.bottom + 4) + 'px;right:' + (window.innerWidth - btnRect.right) + 'px;background:#141414;border:1px solid #808080;border-radius:4px;padding:4px 0;z-index:2147483648;min-width:160px;max-width:300px;max-height:220px;overflow-y:auto;box-shadow:inset 1px 1px 0 rgba(255,255,255,0.08),inset -1px -1px 0 rgba(0,0,0,0.72),0 8px 20px rgba(0,0,0,0.5);font-family:"MS Sans Serif",Tahoma,sans-serif;';
        filtered.forEach(tpl => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:6px 14px;font-size:12px;color:#C0C0C0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            item.textContent = tpl.name;
            item.title = type === 'lyrics' ? (tpl.lyrics || '').substring(0, 120) : (tpl.styles || '').substring(0, 120);
            item.addEventListener('mouseenter', () => { item.style.background = '#1E1E1E'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const field = document.getElementById(fieldId);
                if (field) { field.value = type === 'lyrics' ? (tpl.lyrics || '') : (tpl.styles || ''); field.dispatchEvent(new Event('input', { bubbles: true })); }
                popover.remove();
                document.removeEventListener('click', closePopover, true);
            });
            popover.appendChild(item);
        });
        document.body.appendChild(popover);
        const closePopover = (e) => {
            if (!popover.isConnected) return;
            if (!popover.contains(e.target) && e.target !== btn) { popover.remove(); document.removeEventListener('click', closePopover, true); }
        };
        setTimeout(() => document.addEventListener('click', closePopover, true), 50);
    }

    function populateTemplateDropdowns() { }

    function saveLastAccForm(data) { try { GM_setValue('snd_last_acc_form', JSON.stringify(data)); } catch (e) { } }
    function getLastAccForm() { try { return JSON.parse(GM_getValue('snd_last_acc_form', 'null')); } catch (e) { return null; } }

    function initBtnGroups(container) {
        container.querySelectorAll('.snd-btn-group').forEach(group => {
            group.querySelectorAll('.snd-btn-opt').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.snd-btn-opt').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    group.dataset.value = btn.dataset.val;
                });
            });
        });
    }

    function setBtnGroupValue(id, val) {
        const g = document.getElementById(id);
        if (!g) return;
        g.dataset.value = val;
        g.querySelectorAll('.snd-btn-opt').forEach(b => b.classList.toggle('active', b.dataset.val === val));
    }

    function fillModalFromAcc(data, reuse = false) {
        if (!data) return;
        if (!reuse) {
            const smName = document.getElementById('sm-name');
            if (smName && data.name) smName.value = data.name;
        }
        setBtnGroupValue('sm-provider-group', data.provider || 'google');
        setBtnGroupValue('sm-format-group', data.format || 'mp3');
        const af = document.getElementById('sm-autofill');
        if (af) af.checked = !!data.autoFill;
        const smLyrics = document.getElementById('sm-lyrics');
        if (smLyrics) smLyrics.value = data.lyrics || '';
        const smStyles = document.getElementById('sm-styles');
        if (smStyles) smStyles.value = data.styles || '';
        setBtnGroupValue('sm-voice-group', data.voice || 'none');
        const smSong = document.getElementById('sm-songname');
        if (smSong) smSong.value = data.songName || '';
        const smPassword = document.getElementById('sm-password');
        if (smPassword) smPassword.value = data.password || '';
    }

    function openAccountModal(idx) {
        if (currentModalBackdrop) currentModalBackdrop.remove();
        const accounts = getAccounts();
        let acc;
        if (idx !== null) { acc = { ...accounts[idx] }; }
        else {
            const last = accounts.length ? accounts[accounts.length - 1] : null;
            acc = { id: uid(), name: '', provider: last?.provider || 'google', email: '', password: '', lyrics: last?.lyrics || '', styles: last?.styles || '', voice: last?.voice || 'none', songName: last?.songName || '', format: last?.format || 'mp3', autoFill: last ? last.autoFill : false, enabled: true, done: false };
        }

        const provG = acc.provider || 'google';
        const fmtG = acc.format || 'mp3';
        const voiceG = acc.voice || 'none';
        const hasLast = !!getLastAccForm();

        const backdrop = document.createElement('div');
        backdrop.className = 'snd-modal-backdrop';
        backdrop.innerHTML = `<div class="snd-modal" style="width:calc(100vw - 32px);max-width:440px;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
  <span style="font-weight:700;font-size:14px;color:#C0C0C0;">${idx === null ? 'Add Account' : 'Edit Account'}</span>
  <div style="display:flex;gap:6px;align-items:center;">
    <button id="sm-reuse" title="Fill form from last saved account (email kept)" style="background:#1E1E1E;color:${hasLast ? '#C0C0C0' : '#808080'};border:1px solid ${hasLast ? '#808080' : '#202020'};border-radius:2px;padding:4px 10px;font-size:11px;cursor:pointer;transition:all .15s;">Reuse</button>
    <button id="sm-save-top" title="Save account" style="background:#178CFC;color:#fff;border:none;border-radius:2px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">Save</button>
    <button id="sm-close" style="background:none;border:none;color:#808080;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;" title="Close">X</button>
  </div>
</div>
<div class="sm-top-section">
  <label class="sm-top-label" style="margin-top:0;" title="Optional song title for the Create form">Song Name</label>
  <input id="sm-songname" class="sm-top-input" value="${parseHtml(acc.songName || '')}" placeholder="Optional title..." style="background:rgba(239,68,68,0.1); border-color:#ef4444;"/>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;margin-bottom:3px;">
    <label class="sm-top-label" style="margin:0;" title="Text to paste into the Lyrics field">Lyrics</label>
    <button type="button" class="snd-tpl-pick-btn" data-field="sm-lyrics" data-type="lyrics" title="Pick a lyrics template">&#9660; Template</button>
  </div>
  <textarea id="sm-lyrics" class="sm-top-input" placeholder="Paste lyrics here..." style="min-height:100px;resize:vertical; background:rgba(249,115,22,0.1); border-color:#f97316;">${parseHtml(acc.lyrics || '')}</textarea>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;margin-bottom:3px;">
    <label class="sm-top-label" style="margin:0;" title="Music style prompt">Styles</label>
    <button type="button" class="snd-tpl-pick-btn" data-field="sm-styles" data-type="styles" title="Pick a styles template">&#9660; Template</button>
  </div>
  <textarea id="sm-styles" class="sm-top-input" placeholder="dark hypnotic, drill and bass..." style="min-height:58px;resize:vertical; background:rgba(234,179,8,0.1); border-color:#eab308;">${parseHtml(acc.styles || '')}</textarea>
  <label class="sm-top-label" title="Preferred voice for the song">Voice</label>
  <div class="snd-btn-group snd-btn-group-sm" id="sm-voice-group" data-value="${voiceG}">
    <button type="button" class="snd-btn-opt ${voiceG === 'none' ? 'active' : ''}" data-val="none">&#8212; None</button>
    <button type="button" class="snd-btn-opt ${voiceG === 'male' ? 'active' : ''}" data-val="male">Male</button>
    <button type="button" class="snd-btn-opt ${voiceG === 'female' ? 'active' : ''}" data-val="female">Female</button>
  </div>
</div>
<div style="border-top:1px solid #808080;margin:12px 0 10px;"></div>
<label title="Display name for this account">Name (label)</label>
<input id="sm-name" value="${parseHtml(acc.name)}" placeholder="My Google Account"/>
<label title="Account email for login">Email</label>
<input id="sm-email" value="${parseHtml(acc.email)}" placeholder="user@gmail.com" type="email"/>
<label title="Optional password for auto-login bypass">Password (Auto-Fill)</label>
<input id="sm-password" type="password" value="${parseHtml(acc.password)}" placeholder="Leave blank to type manually"/>
<label title="Login provider">Provider</label>
<div class="snd-btn-group snd-btn-group-sm" id="sm-provider-group" data-value="${provG}">
  <button type="button" class="snd-btn-opt ${provG === 'google' ? 'active' : ''}" data-val="google">Google</button>
  <button type="button" class="snd-btn-opt ${provG === 'microsoft' ? 'active' : ''}" data-val="microsoft">Microsoft</button>
</div>
<label title="Download format">Format</label>
<div class="snd-btn-group snd-btn-group-sm" id="sm-format-group" data-value="${fmtG}">
  <button type="button" class="snd-btn-opt ${fmtG === 'mp3' ? 'active' : ''}" data-val="mp3">MP3</button>
  <button type="button" class="snd-btn-opt ${fmtG === 'wav' ? 'active' : ''}" data-val="wav">WAV</button>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:12px;">
  <input type="checkbox" id="sm-autofill" ${acc.autoFill ? 'checked' : ''} style="width:auto;"/>
  <label for="sm-autofill" style="margin:0;color:#178CFC;cursor:pointer;" title="Automatically fill lyrics/styles when logging in">Auto-fill Create form on login</label>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
  <input type="checkbox" id="sm-enabled" ${acc.enabled ? 'checked' : ''} style="width:auto;"/>
  <label for="sm-enabled" style="margin:0;color:#C0C0C0;cursor:pointer;" title="Include in auto-chain sequence">Enabled in auto-chain</label>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
  <input type="checkbox" id="sm-done" ${acc.done ? 'checked' : ''} style="width:auto;"/>
  <label for="sm-done" style="margin:0;color:#C0C0C0;cursor:pointer;" title="Move to archive, skip in chain">Mark as Done (archive)</label>
</div>
<div style="display:flex;gap:8px;margin-top:20px;">
  <button id="sm-save" style="flex:1;background:#178CFC;color:#fff;border:none;border-radius:2px;padding:10px 0;font-size:13px;font-weight:600;cursor:pointer;">Save</button>
  <button id="sm-cancel" style="background:#1E1E1E;color:#C0C0C0;border:1px solid #808080;border-radius:2px;padding:10px 16px;font-size:13px;cursor:pointer;">Cancel</button>
</div>
</div>`;
        document.body.appendChild(backdrop);
        currentModalBackdrop = backdrop;

        ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'pointerdown', 'pointerup'].forEach(ev =>
            backdrop.addEventListener(ev, e => e.stopPropagation())
        );

        try {
            initBtnGroups(backdrop);
            populateTemplateDropdowns();
        } catch (e) { console.error('[SND] modal init crashed:', e); }

        backdrop.querySelectorAll('.snd-tpl-pick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showTemplatePicker(btn, btn.dataset.field, btn.dataset.type);
            });
        });

        document.getElementById('sm-reuse').onclick = () => {
            const last = getLastAccForm();
            if (!last) { addLog('No saved form data yet - save an account first.', '#f59e0b'); return; }
            try {
                fillModalFromAcc(last, true);
                populateTemplateDropdowns();
                addLog('Form loaded from last saved account.', '#d4a574');
            } catch (e) { console.error('[SND] reuse blew up:', e); }
        };

        const closeModal = () => { backdrop.remove(); currentModalBackdrop = null; backdrop.removeEventListener('keydown', onEsc); };
        document.getElementById('sm-cancel').onclick = closeModal;
        document.getElementById('sm-close').onclick = closeModal;
        document.getElementById('sm-save-top').onclick = () => document.getElementById('sm-save').click();
        const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } };
        backdrop.addEventListener('keydown', onEsc);
        backdrop.setAttribute('tabindex', '-1');
        backdrop.focus();

        document.getElementById('sm-save').onclick = () => {
            try {
                const getGroupVal = (id) => document.getElementById(id)?.dataset.value || '';
                const updated = {
                    id: acc.id,
                    name: document.getElementById('sm-name').value.trim(),
                    email: document.getElementById('sm-email').value.trim(),
                    password: document.getElementById('sm-password').value,
                    provider: getGroupVal('sm-provider-group'),
                    format: getGroupVal('sm-format-group'),
                    autoFill: document.getElementById('sm-autofill').checked,
                    lyrics: document.getElementById('sm-lyrics')?.value || '',
                    styles: document.getElementById('sm-styles')?.value || '',
                    voice: getGroupVal('sm-voice-group'),
                    songName: document.getElementById('sm-songname')?.value || '',
                    enabled: document.getElementById('sm-enabled').checked,
                    done: document.getElementById('sm-done').checked,
                    lastEdited: Date.now()
                };
                if (!updated.email) { alert('Email is required! How else will we log in?'); return; }
                const arr = getAccounts();
                if (idx === null) arr.push(updated); else arr[idx] = updated;
                saveAccounts(arr);
                saveLastAccForm(updated);
                closeModal();
                renderAccounts();
            } catch (e) { console.error('[SND] save blew up:', e); }
        };
    }

    function waitForBody(cb) { if (document.body) { cb(); return; } const obs = new MutationObserver(() => { if (document.body) { obs.disconnect(); cb(); } }); obs.observe(document.documentElement, { childList: true }); }

    function boot() {
        if (IS_GOOGLE) { waitForBody(() => setTimeout(handleGoogleChooser, 1200)); return; }
        if (IS_MSFT) { waitForBody(() => setTimeout(handleMicrosoftLogin, 1200)); return; }
        if (IS_SUNO) {
            initNetworkHooks();
            installSunoLoginWatchdog();
            ensureWidgetSoon();
            const auto = getAuto();
            const acc = getAccounts()[auto.currentIdx];
            if ((auto.active || auto.pendingLogin) && acc && !isSunoSigninPath()) {
                if (auto.step === 'login_pending' && auto.oauthVisited) completeOAuthLogin();
                else setTimeout(() => checkSunoCachedLogin('boot'), 500);
            }
            if (isSunoSigninPath() && (auto.active || auto.pendingLogin)) setTimeout(() => handleSunoSignin(), 2000);
            initEmergencyUI();
        }
    }

    boot();
})();