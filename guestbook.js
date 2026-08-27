/* bleifer.ai -- guestbook + live visitor counts, backed by Firebase RTDB.
 *
 * The guestbook reads/writes the same `guestbook` node the old contact page
 * used, so every existing entry carried over. The counters use two new nodes
 * under `bleiferAi/` -- see database.rules.json in the stevenbleifer.com repo.
 *
 * The validation helpers below (invisible-char stripping, leetspeak
 * normalisation, profanity/link filtering, honeypot, rate limiting) are ported
 * unchanged from the original contact-page implementation.
 */
(function () {
    'use strict';

    function offline(msg) {
        var c = document.getElementById('gb-entries');
        if (c) c.innerHTML = '<p class="gb-note">' + msg + '</p>';
        var b = document.getElementById('gb-submit');
        if (b) { b.disabled = true; b.textContent = 'Guestbook offline'; }
    }

    if (typeof firebase === 'undefined') {
        offline('The guestbook could not load. Please try again later.');
        return;
    }

    var firebaseConfig = {
        apiKey: "AIzaSyA5tENtcv1dlgKdfkueuHh7RdPVLRon7Os",
        authDomain: "stevenbleifer-site.firebaseapp.com",
        databaseURL: "https://stevenbleifer-site-default-rtdb.firebaseio.com",
        projectId: "stevenbleifer-site",
        storageBucket: "stevenbleifer-site.firebasestorage.app",
        messagingSenderId: "905082036677",
        appId: "1:905082036677:web:bffccd9bf2ff1e323babac"
    };

    firebase.initializeApp(firebaseConfig);
    var appCheck = firebase.appCheck();
    appCheck.activate('6Lf27JYsAAAAAEyCo8IuD5cIQ5qOE6zWJ72my6kQ', true);

    var db = firebase.database();

    var INVISIBLE_RE = /[̀-ͯ​‌‍‎‏⁠⁡⁢⁣⁤﻿­͏؜᠎  ‪-‮⁦-⁩￹-￻]/g;
    function stripInvisible(s) { return s.replace(INVISIBLE_RE, ''); }

    var LEET_MAP = {
        '@':'a','4':'a','^':'a','à':'a','á':'a','â':'a','ã':'a','ä':'a',
        '8':'b','(':'c','ç':'c','ð':'d','3':'e','è':'e','é':'e','ê':'e','ë':'e',
        '6':'g','#':'h','1':'i','!':'i','|':'i','ì':'i','í':'i','î':'i','ï':'i',
        '0':'o','ò':'o','ó':'o','ô':'o','õ':'o','ö':'o','5':'s','$':'s',
        '7':'t','+':'t','ù':'u','ú':'u','û':'u','ü':'u','2':'z',
        'а':'a','е':'e','і':'i','о':'o','р':'p','с':'c','у':'y','х':'x','Ь':'b','ъ':'b',
        'В':'b','Н':'h','М':'m','Т':'t','н':'h','м':'m','т':'t','в':'b','к':'k','К':'k',
        'α':'a','ε':'e','ι':'i','ο':'o','ρ':'p','κ':'k','ν':'v','τ':'t','υ':'u','ω':'w'
    };
    function normalizeLeet(text) {
        var result = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text[i].toLowerCase();
            result += LEET_MAP[ch] || ch;
        }
        return result;
    }
    function collapseRepeats(text) { return text.replace(/(.)\1{1,}/g, '$1'); }

    var BLOCKED = ['fuck','shit','ass','damn','bitch','bastard','dick','cock','pussy','cunt','nigger','nigga','faggot','fag','retard','retarded','slut','whore','kike','spic','chink','wetback','beaner','tranny','dyke','asshole','dumbass','jackass','motherfucker','bullshit','goddamn','dildo','porn','rape','nazi','hitler','kkk','stfu','gtfo','lmfao','piss','twat','wanker','tosser','bellend','bollocks','arse','arsehole','shag','bugger','sodoff','prick','tit','tits','boob','boobs','penis','vagina','scrotum','nutsack','cumshot','cum','jizz','fellatio','blowjob','handjob','rimjob','anal','anus','orgy','hentai','milf','gilf','bdsm','bondage','fetish','orgasm','erection','ejaculate','masturbat','pedophil','paedophil','molest','incest','bestiality','necrophil','genocide','terrorist','jihad','supremacist','antisemit'];
    var BLOCKED_STEMS = ['fuck','shit','bitch','cunt','nigger','nigga','faggot','retard','slut','whore','kike','spic','chink','wetback','beaner','tranny','dyke','wank','piss','twat','cock','dick','bastard','damn','prick','bollock','arsehole','asshole','dumbass','jackass','bullshit','goddamn','motherfuck','pedophil','paedophil','molest','masturb','ejaculat','terrorist'];

    function hasBadWords(text) {
        var t = text.toLowerCase();
        var lettersOnly = t.replace(/[^a-z]/g, '');
        var leetNorm = normalizeLeet(t);
        var leetLetters = leetNorm.replace(/[^a-z]/g, '');
        var collapsed = collapseRepeats(lettersOnly);
        var collapsedLeet = collapseRepeats(leetLetters);
        var variants = [t, lettersOnly, leetLetters, collapsed, collapsedLeet];
        for (var i = 0; i < BLOCKED.length; i++) {
            var w = BLOCKED[i];
            var re = new RegExp('\\b' + w + '\\b', 'i');
            if (re.test(t) || re.test(leetNorm)) return true;
            for (var j = 0; j < variants.length; j++) if (variants[j].indexOf(w) !== -1) return true;
        }
        for (var i = 0; i < BLOCKED_STEMS.length; i++) {
            var stem = BLOCKED_STEMS[i];
            for (var j = 0; j < variants.length; j++) if (variants[j].indexOf(stem) !== -1) return true;
        }
        if (/https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.xyz|\.ru|\.tk|\.ml|\.ga|\.cf|\.gq|bit\.ly|tinyurl|t\.co/i.test(t)) return true;
        if (/\S+@\S+\.\S+/.test(t)) return true;
        if (/<\s*script|<\s*img|<\s*iframe|<\s*object|<\s*embed|javascript:|onerror|onload|onclick/i.test(t)) return true;
        return false;
    }

    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function sanitize(s) {
        return s.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, function(c) {
            return {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c];
        });
    }

    var RATE_LIMIT = 3;
    var RATE_WINDOW = 10 * 60 * 1000;
    function checkRateLimit() {
        try {
            var subs = JSON.parse(sessionStorage.getItem('gb_submissions') || '[]');
            var now = Date.now();
            subs = subs.filter(function(t){ return now - t < RATE_WINDOW; });
            sessionStorage.setItem('gb_submissions', JSON.stringify(subs));
            return subs.length < RATE_LIMIT;
        } catch(e) { return true; }
    }
    function recordSubmission() {
        try {
            var subs = JSON.parse(sessionStorage.getItem('gb_submissions') || '[]');
            subs.push(Date.now());
            sessionStorage.setItem('gb_submissions', JSON.stringify(subs));
        } catch(e) {}
    }

    function renderEntries(entries) {
        var c = document.getElementById('gb-entries');
        var empty = document.getElementById('gb-empty');
        if (!entries || !entries.length) {
            c.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        var html = '';
        var show = entries.slice(-20).reverse();
        for (var i = 0; i < show.length; i++) {
            var e = show[i];
            html += '<div class="gb-entry">';
            html += '<span class="gb-name">' + esc(e.name) + '</span>';
            html += '<span class="gb-date">' + esc(e.date) + '</span>';
            html += '<p class="gb-message">' + esc(e.message) + '</p>';
            html += '</div>';
        }
        c.innerHTML = html;
    }

    function isCleanEntry(e) {
        if (!e || typeof e.name !== 'string' || typeof e.message !== 'string' || typeof e.date !== 'string') return false;
        if (e.name.length > 30 || e.message.length > 200) return false;
        if (hasBadWords(e.name) || hasBadWords(e.message)) return false;
        if (/<[^>]*>/i.test(e.name) || /<[^>]*>/i.test(e.message)) return false;
        if (/javascript:|onerror|onload|onclick/i.test(e.name) || /javascript:|onerror|onload|onclick/i.test(e.message)) return false;
        if (!/[a-zA-Z0-9]/.test(e.name) || !/[a-zA-Z0-9]/.test(e.message)) return false;
        return true;
    }

    db.ref('guestbook').orderByChild('timestamp').limitToLast(50).on('value', function(snapshot) {
        var entries = [];
        snapshot.forEach(function(child) {
            var e = child.val();
            if (isCleanEntry(e)) entries.push(e);
        });
        renderEntries(entries);
    });

    function doSubmit() {
        var n = document.getElementById('gb-name');
        var m = document.getElementById('gb-message');
        var err = document.getElementById('gb-error');
        var btn = document.getElementById('gb-submit');
        var honeypot = document.getElementById('gb-website');

        var name = stripInvisible(n.value).trim();
        var msg = stripInvisible(m.value).trim();
        err.style.display = 'none';

        if (honeypot && honeypot.value) {
            n.value = ''; m.value = '';
            alert('Thanks for signing the guestbook.');
            return;
        }

        if (!checkRateLimit()) {
            err.textContent = 'Slow down — three signatures per ten minutes.';
            err.style.display = 'block'; return;
        }
        if (!name || !msg || !/\S/.test(name) || !/\S/.test(msg)) {
            err.textContent = 'Please fill in both your name and message.';
            err.style.display = 'block'; return;
        }
        if (!/[a-zA-Z0-9]/.test(name) || !/[a-zA-Z0-9]/.test(msg)) {
            err.textContent = 'Name and message must contain at least one letter or number.';
            err.style.display = 'block'; return;
        }
        if (name.length > 30 || msg.length > 200) {
            err.textContent = 'Name max 30 chars, message max 200.';
            err.style.display = 'block'; return;
        }
        if (hasBadWords(name) || hasBadWords(msg)) {
            err.textContent = 'Please keep it clean — no inappropriate language or links.';
            err.style.display = 'block'; return;
        }
        if (/^(.)\1{4,}$/.test(name.replace(/\s/g,'')) || /^(.)\1{9,}$/.test(msg.replace(/\s/g,''))) {
            err.textContent = 'Please write a real message.';
            err.style.display = 'block'; return;
        }

        btn.disabled = true;
        btn.textContent = 'Signing…';

        var cleanName = sanitize(name).substring(0, 30);
        var cleanMsg = sanitize(msg).substring(0, 200);
        var d = new Date();
        var entry = {
            name: cleanName,
            message: cleanMsg,
            date: d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
            timestamp: d.getTime()
        };

        db.ref('guestbook').push(entry).then(function() {
            n.value = ''; m.value = '';
            btn.disabled = false;
            btn.textContent = 'Sign guestbook';
            recordSubmission();
            alert('Thanks for signing the guestbook.');
        }).catch(function() {
            err.textContent = 'Couldn\'t save your entry. Please try again.';
            err.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Sign guestbook';
        });
    }

    Object.defineProperty(window, 'submitGuestbook', { value: doSubmit, writable: false, configurable: false });

    /* ---- live visitor counts ------------------------------------------ */

    var STALE = 90 * 1000;        // a heartbeat older than this is a dead tab
    var viewsEl = document.getElementById('hits');
    var liveEl = document.getElementById('live-now');

    // Server clock, so we don't judge heartbeats against a skewed local clock.
    var skew = 0;
    db.ref('.info/serverTimeOffset').on('value', function (s) { skew = s.val() || 0; });
    function serverNow() { return Date.now() + skew; }

    // Total page views. Counted once per browser session.
    var viewsRef = db.ref('bleiferAi/views');
    viewsRef.on('value', function (s) {
        if (viewsEl) viewsEl.textContent = String(s.val() || 0).padStart(8, '0');
    }, function (e) {
        viewsUnavailable();
        window.__baViewsError = (e && (e.code || e.message)) || 'unknown';
    });


    // A transaction updates the local cache optimistically, so a rejected write
    // would otherwise leave a plausible-looking but invented number on screen.
    // Only trust a committed result.
    function viewsUnavailable() { if (viewsEl) viewsEl.textContent = '--------'; }

    var viewsOk = false, presenceOk = false;
    var counted = false;
    try { counted = sessionStorage.getItem('ba_counted') === '1'; } catch (e) {}

    if (!counted) {
        viewsRef.transaction(function (cur) { return (cur || 0) + 1; })
            .then(function (res) {
                if (!res || !res.committed) { viewsUnavailable(); return; }
                viewsOk = true;
                try { sessionStorage.setItem('ba_counted', '1'); } catch (e) {}
            })
            .catch(viewsUnavailable);
    } else {
        viewsRef.once('value')
            .then(function () { viewsOk = true; })
            .catch(viewsUnavailable);
    }

    // A blocked request hangs rather than rejecting, so time it out. Otherwise
    // the optimistic local value sits on screen looking like a real count.
    setTimeout(function () {
        if (!viewsOk) viewsUnavailable();
        if (!presenceOk && liveEl) liveEl.textContent = '?';
    }, 8000);

    // Who is on the page right now. Each tab writes a heartbeat and clears it
    // on disconnect; we count the heartbeats that are still fresh.
    var presRef = db.ref('bleiferAi/presence');
    var me = presRef.push();
    var beat = null;

    db.ref('.info/connected').on('value', function (snap) {
        if (snap.val() !== true) return;
        me.onDisconnect().remove();            // covers crashes and lost network
        function ping() { me.set({ ts: firebase.database.ServerValue.TIMESTAMP }); }
        ping();
        if (beat) clearInterval(beat);
        beat = setInterval(ping, 30000);
    });

    presRef.on('value', function (snap) {
        presenceOk = true;
        var now = serverNow(), live = 0;
        snap.forEach(function (child) {
            var v = child.val();
            if (!v || typeof v.ts !== 'number') return;
            if (now - v.ts < STALE) live++;
            else child.ref.remove();           // tidy up tabs that died badly
        });
        if (liveEl) liveEl.textContent = String(Math.max(live, 1));
    }, function () {
        if (liveEl) liveEl.textContent = '?';
    });

    window.addEventListener('pagehide', function () {
        if (beat) clearInterval(beat);
        me.remove();
    });

    // Probe the guestbook explicitly so we can report *why* it failed rather
    // than leaving a generic message. Diagnostic detail only appears on
    // failure; a working page never shows it.
    var probeDone = false;
    db.ref('guestbook').limitToLast(1).once('value')
        .then(function () { probeDone = true; })
        .catch(function (e) {
            probeDone = true;
            offline('Guestbook error: ' + (e.code || e.message || String(e)));
        });

    setTimeout(function () {
        var c = document.getElementById('gb-entries');
        if (!probeDone) {
            offline('Guestbook error: no response from Firebase (request hung).');
        } else if (c && /Loading entries/.test(c.textContent)) {
            offline('Guestbook error: connected, but no entries came back.');
        }
    }, 8000);

})();
