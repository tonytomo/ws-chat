(() => {
    'use strict';

    /* ============================================================
       Configuration from URL params
       ============================================================
       ?key=<API_KEY>        (required)  API key
       ?ws=<url>             (optional)  override the WebSocket endpoint
       ============================================================ */

    const API_KEY = window.Config.apiKey;
    const WS_OVERRIDE = window.Config.wsOverride;

    const params = new URLSearchParams(location.search);

    // Prefer URL params (shareable), fall back to the session handoff from the lobby.
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('ws.pendingRoom') || 'null'); } catch { }

    const ROOM = (params.get('room') || pending?.room || '').trim();
    const PASSCODE = (params.get('passcode') || pending?.passcode || '');
    const ROOM_KIND = (params.get('kind') || pending?.kind || 'chat').trim();

    // One-shot: clear it so a later refresh doesn't silently re-join.
    sessionStorage.removeItem('ws.pendingRoom');

    if (!ROOM) {
        setStatus('error', 'No room');
        showBanner('error', 'No room specified. Pick one from the lobby.', false);
        lockComposer();
        return;
    }

    const ROOM_RE = /^[a-zA-Z0-9_-]{1,64}$/;
    const HEARTBEAT_MS = 25_000;
    const PONG_TIMEOUT_MS = 10_000;

    if (!ROOM) {
        setStatus('error', 'No room');
        showBanner('error', 'No room specified. Pick one from the lobby.', false);
        lockComposer();
        return;
    }

    /* ---------- DOM ---------- */
    const $ = (id) => document.getElementById(id);
    const els = {
        roomName: $('room-name'),
        memberCount: $('member-count'),
        status: $('status'),
        statusText: $('status-text'),
        messages: $('messages'),
        banner: $('banner'),
        form: $('composer'),
        input: $('input'),
        send: $('send'),
    };

    els.roomName.textContent = ROOM;

    /* ---------- Local state ---------- */
    let ws = null;
    let clientId = null;
    let selfLabel = null;
    let members = 0;
    let channels = [];
    let chatChannel = null;
    let online = false;

    let pendingJoin = false;
    let creatingRoom = false;
    let rateLimitedUntil = 0;

    let heartbeatTimer = null;
    let pongTimer = null;
    let bannerTimer = null;
    let closedByUs = false;
    let sawWelcome = false;   // set to true in onWelcome()

    /* ============================================================
       Boot / validation
       ============================================================ */

    if (!API_KEY) {
        setStatus('error', 'No API key');
        showBanner('error', 'Missing API key. Append ?key=YOUR_KEY to this URL.', true);
        lockComposer();
        return;
    }

    if (!ROOM_RE.test(ROOM)) {
        setStatus('error', 'Invalid room');
        showBanner('error', 'Invalid room name. Use 1–64 characters from [a-zA-Z0-9_-].', true);
        lockComposer();
        return;
    }

    connect();

    /* ============================================================
       Connection
       ============================================================ */

    function wsUrl() {
        if (WS_OVERRIDE) {
            const u = new URL(WS_OVERRIDE, location.href);
            u.searchParams.set('key', API_KEY);
            return u.toString();
        }
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const base = `${proto}//${location.host}/ws`;
        return `${base}?key=${encodeURIComponent(API_KEY)}`;
    }

    function connect() {
        closedByUs = false;
        sawWelcome = false
        pendingJoin = false;
        creatingRoom = false;

        setStatus('connecting', 'Connecting…');
        hideBanner();
        lockComposer();

        try {
            ws = new WebSocket(wsUrl());
        } catch (err) {
            setStatus('error', 'Failed');
            showBanner('error', 'Could not create WebSocket: ' + err.message, true);
            return;
        }

        ws.addEventListener('open', () => {
            // Server sends `welcome` immediately; wait for it.
            setStatus('connecting', 'Authenticating…');
        });

        ws.addEventListener('message', onMessage);

        ws.addEventListener('close', (ev) => {
            stopHeartbeat();
            online = false;
            lockComposer();

            if (closedByUs) return;

            if (ev.code === 1008) {
                setStatus('error', 'Disconnected');
                showBanner('error', 'Connection closed by server: ' + (ev.reason || 'policy violation'), true);
            } else if (ev.code === 1001) {
                setStatus('error', 'Server away');
                showBanner('warn', 'Server is shutting down.', true);
            } else {
                setStatus('error', 'Disconnected');
                showBanner('error', 'Connection lost.', true);
            }
        });

        ws.addEventListener('error', () => {
            // `close` fires right after; nothing extra to do here.
        });
    }

    function disconnect() {
        closedByUs = true;
        stopHeartbeat();
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close(1000, 'client leaving');
        }
        ws = null;
    }

    /* ============================================================
       Inbound dispatch
       ============================================================ */

    function onMessage(ev) {
        if (typeof ev.data !== 'string') {
            // Binary frames are not used by this chat client.
            return;
        }

        clearPongTimer();

        let msg;
        try {
            msg = JSON.parse(ev.data);
        } catch {
            return;
        }

        switch (msg.type) {
            case 'welcome': onWelcome(msg); break;
            case 'room_created': onRoomCreated(msg); break;
            case 'room_joined': onRoomJoined(msg); break;
            case 'room_left': onRoomLeft(msg); break;
            case 'message': onBroadcast(msg); break;
            case 'error': onError(msg); break;
            case 'pong':         /* liveness confirmed */ break;
            default:             /* ignore unknown */ break;
        }
    }

    function onWelcome(msg) {
        clientId = msg.client_id;
        selfLabel = msg.label;

        // 1) Try to join the room.
        attemptJoin();
    }

    function attemptJoin() {
        pendingJoin = true;
        send({ type: 'join_room', room: ROOM, passcode: PASSCODE });
    }

    function onRoomCreated() {
        creatingRoom = false;
        // Now join the room we just created.
        attemptJoin();
    }

    function onRoomJoined(msg) {
        pendingJoin = false;
        creatingRoom = false;
        online = true;

        members = msg.members || 1;
        channels = Array.isArray(msg.channels) ? msg.channels.slice() : [];

        chatChannel = pickChatChannel(channels);

        if (!chatChannel) {
            setStatus('error', 'No writable channel');
            showBanner('error', 'This room has no client-writable channel.', true);
            lockComposer();
            return;
        }

        updateMemberCount();
        setStatus('online', 'Online');
        hideBanner();
        unlockComposer();
        startHeartbeat();
    }

    function onRoomLeft() {
        online = false;
        lockComposer();
        setStatus('connecting', 'Left room');
    }

    function onBroadcast(msg) {
        if (msg.channel === 'presence') {
            handlePresence(msg.payload);
            return;
        }

        // Peer chat message.
        if (msg.from === selfLabel) {
            // Already rendered optimistically; skip the echo.
            return;
        }

        renderChat({
            from: msg.from,
            text: extractText(msg.payload),
            ts: msg.ts,
            own: false,
        });
    }

    function handlePresence(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (payload.event === 'join') {
            members = Math.max(1, members + 1);
            updateMemberCount();
            renderSystem(`${payload.who} joined`);
        } else if (payload.event === 'leave') {
            members = Math.max(1, members - 1);
            updateMemberCount();
            renderSystem(`${payload.who} left`);
        }
    }

    /* ============================================================
       Outbound
       ============================================================ */

    function send(obj) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(obj));
        return true;
    }

    function sendChat(text) {
        if (!online || !chatChannel) return;
        if (Date.now() < rateLimitedUntil) return;

        const ok = send({
            type: 'publish',
            room: ROOM,
            channel: chatChannel,
            payload: { text },
        });

        if (ok) {
            renderChat({ from: selfLabel, text, ts: Math.floor(Date.now() / 1000), own: true });
        }
    }

    /* ============================================================
       Heartbeat
       ============================================================ */

    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            send({ type: 'ping' });
            clearPongTimer();
            pongTimer = setTimeout(() => {
                // No pong in time — treat as dead.
                showBanner('warn', 'Connection appears stale. Reconnecting is recommended.', true);
            }, PONG_TIMEOUT_MS);
        }, HEARTBEAT_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        clearPongTimer();
    }

    function clearPongTimer() {
        if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
    }

    /* ============================================================
       Error handling
       ============================================================ */

    function onError(msg) {
        const code = msg.code || 'ERROR';
        const text = msg.message || 'Unknown error';

        switch (code) {
            case 'ROOM_NOT_FOUND':
                if (pendingJoin && !creatingRoom) {
                    pendingJoin = false;
                    creatingRoom = true;
                    send({ type: 'create_room', room: ROOM, kind: ROOM_KIND });
                    return;
                }
                fail(text);
                return;

            case 'ROOM_ALREADY_EXISTS':
                // Lost a race creating the room — just join it.
                if (creatingRoom) {
                    creatingRoom = false;
                    attemptJoin();
                    return;
                }
                fail(text);
                return;

            case 'RATE_LIMITED': {
                const wait = Number(msg.retry_after_ms) || 250;
                rateLimitedUntil = Date.now() + wait;
                showBanner('warn', `Slow down — try again in ${wait} ms.`, false, 1500);
                return;
            }

            case 'CHANNEL_READ_ONLY':
            case 'CHANNEL_NOT_FOUND':
            case 'CHANNEL_NOT_RELIABLE':
                fail(`Channel error (${code}): ${text}`);
                return;

            case 'INVALID_PASSCODE':
            case 'PASSCODE_RATE_LIMITED':
            case 'ROOM_FULL':
            case 'MAX_ROOMS_REACHED':
            case 'FORBIDDEN_SCOPE':
            case 'BAD_REQUEST':
            case 'INTERNAL_ERROR':
            case 'BINARY_NOT_ALLOWED':
            case 'RESERVED_CHANNEL_NAME':
            default:
                fail(`${code}: ${text}`);
                return;
        }
    }

    function fail(message) {
        pendingJoin = false;
        creatingRoom = false;
        setStatus('error', 'Error');
        showBanner('error', message, true);
        lockComposer();
    }

    /* ============================================================
       Rendering
       ============================================================ */

    function extractText(payload) {
        if (payload == null) return '';
        if (typeof payload === 'string') return payload;
        if (typeof payload === 'object' && typeof payload.text === 'string') return payload.text;
        try { return JSON.stringify(payload); } catch { return String(payload); }
    }

    function renderChat({ from, text, ts, own }) {
        const row = document.createElement('div');
        row.className = 'row ' + (own ? 'row--own' : 'row--other');

        if (!own) {
            const sender = document.createElement('span');
            sender.className = 'sender';
            sender.textContent = from || 'unknown';
            row.appendChild(sender);
        }

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = text;
        row.appendChild(bubble);

        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = formatTime(ts);
        row.appendChild(time);

        appendToFeed(row);
    }

    function renderSystem(text) {
        const el = document.createElement('div');
        el.className = 'system';
        el.textContent = text;
        appendToFeed(el);
    }

    function appendToFeed(el) {
        const nearBottom =
            els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 120;

        els.messages.appendChild(el);

        if (nearBottom) {
            els.messages.scrollTop = els.messages.scrollHeight;
        }
    }

    function formatTime(ts) {
        const d = ts ? new Date(ts * 1000) : new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* ============================================================
       UI helpers
       ============================================================ */

    function pickChatChannel(list) {
        if (list.includes('chat')) return 'chat';
        if (list.includes('default')) return 'default';
        return list.find((c) => c !== 'presence') || null;
    }

    function updateMemberCount() {
        els.memberCount.textContent = `${members} online`;
    }

    function setStatus(kind, text) {
        els.status.className = 'status status--' + kind;
        els.statusText.textContent = text;
    }

    function lockComposer() {
        els.input.disabled = true;
        els.send.disabled = true;
    }

    function unlockComposer() {
        els.input.disabled = false;
        els.send.disabled = false;
        els.input.focus();
    }

    function showBanner(kind, text, withReconnect = false, autoHideMs = 0) {
        if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }

        els.banner.replaceChildren();
        els.banner.dataset.kind = kind;

        const span = document.createElement('span');
        span.textContent = text;
        els.banner.appendChild(span);

        if (withReconnect) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Reconnect';
            btn.addEventListener('click', () => {
                disconnect();
                connect();
            });
            els.banner.appendChild(btn);
        }

        els.banner.hidden = false;

        if (autoHideMs > 0) {
            bannerTimer = setTimeout(hideBanner, autoHideMs);
        }
    }

    function hideBanner() {
        if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
        els.banner.hidden = true;
        els.banner.replaceChildren();
    }

    /* ============================================================
       Composer events
       ============================================================ */

    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = els.input.value.trim();
        if (!text || !online) return;
        if (Date.now() < rateLimitedUntil) return;

        sendChat(text);
        els.input.value = '';
        els.input.focus();
    });

    // Leave the room cleanly when the tab closes.
    window.addEventListener('pagehide', () => {
        if (online) send({ type: 'leave_room', room: ROOM });
        disconnect();
    });
})();