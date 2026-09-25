(() => {
    'use strict';

    /* ============================================================
       Config from URL:
         ?key=<API_KEY>   (required)
         ?ws=<url>        (optional) override WebSocket endpoint
       ============================================================ */

    const API_KEY = window.Config.apiKey;
    const WS_OVERRIDE = window.Config.wsOverride;

    const ROOM_RE = /^[a-zA-Z0-9_-]{1,64}$/;
    const POLL_MS = 5000;

    /* ---------- DOM ---------- */
    const $ = (id) => document.getElementById(id);
    const els = {
        userLabel: $('user-label'),
        roomCount: $('room-count'),
        status: $('status'),
        statusText: $('status-text'),
        filter: $('filter'),
        refresh: $('refresh'),
        createOpen: $('create-open'),
        banner: $('banner'),
        rooms: $('rooms'),
        lastUpdated: $('last-updated'),

        dialog: $('create-dialog'),
        createForm: $('create-form'),
        crName: $('cr-name'),
        crKind: $('cr-kind'),
        crPasscode: $('cr-passcode'),
        crMax: $('cr-max'),
        crEphemeral: $('cr-ephemeral'),
        crError: $('cr-error'),
        crSubmit: $('cr-submit'),
    };

    /* ---------- State ---------- */
    let ws = null;
    let selfLabel = null;
    let rooms = [];
    let pendingCreate = false;
    let pollTimer = null;
    let reconnectTimer = null;
    let closedByUs = false;
    let sawWelcome = false;   // set to true in onWelcome()
    let lastRoomsSig = '';

    /* ============================================================
       Boot
       ============================================================ */

    if (!API_KEY) {
        setStatus('error', 'No key');
        showBanner('error', 'Missing API key. Append ?key=YOUR_KEY to this URL.', true);
        els.createOpen.disabled = true;
        return;
    }

    connect();

    /* ============================================================
       WebSocket
       ============================================================ */

    function wsUrl() {
        if (WS_OVERRIDE) {
            const u = new URL(WS_OVERRIDE, location.href);
            u.searchParams.set('key', API_KEY);
            return u.toString();
        }
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}/ws?key=${encodeURIComponent(API_KEY)}`;
    }

    function connect() {
        closedByUs = false;
        sawWelcome = false;
        clearTimeout(reconnectTimer);
        setStatus('connecting', 'Connecting…');

        try {
            ws = new WebSocket(wsUrl());
        } catch (err) {
            setStatus('error', 'Failed');
            showBanner('error', 'Could not create WebSocket: ' + err.message, false);
            scheduleReconnect();
            return;
        }

        ws.addEventListener('open', () => setStatus('connecting', 'Authenticating…'));
        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', onClose);
        ws.addEventListener('error', () => { /* close follows */ });
    }

    function disconnect() {
        closedByUs = true;
        stopPolling();
        clearTimeout(reconnectTimer);
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close(1000, 'lobby closing');
        }
        ws = null;
    }

    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
    }

    function onClose(ev) {
        stopPolling();
        if (closedByUs) return;

        if (!sawWelcome) {
            showBanner(
                'error',
                'Connection rejected. Your stored key may be invalid or expired.',
                false
            );
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Reset key';
            btn.addEventListener('click', () => {
                window.Config.clear();
                location.href = 'index.html';
            });
            els.banner.appendChild(btn);
        }

        if (ev.code === 1008) {
            setStatus('error', 'Rejected');
            showBanner('error', 'Server rejected connection: ' + (ev.reason || 'policy violation') +
                '. Check your API key.', false);
        } else if (ev.code === 1001) {
            setStatus('error', 'Server away');
            showBanner('warn', 'Server is shutting down.', false);
        } else {
            setStatus('error', 'Disconnected');
            scheduleReconnect();
        }
    }

    function send(obj) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify(obj));
        return true;
    }

    /* ============================================================
       Inbound messages
       ============================================================ */

    function onMessage(ev) {
        if (typeof ev.data !== 'string') return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }

        switch (msg.type) {
            case 'welcome': onWelcome(msg); break;
            case 'room_list': onRoomList(msg); break;
            case 'room_created': onRoomCreated(msg); break;
            case 'error': onError(msg); break;
            case 'pong': break;
            default: break;
        }
    }

    function onWelcome(msg) {
        selfLabel = msg.label;
        els.userLabel.textContent = msg.label || '';
        setStatus('online', 'Online');
        hideBanner();

        requestRooms();
        startPolling();
    }

    function onRoomList(msg) {
        rooms = Array.isArray(msg.rooms) ? msg.rooms : [];
        const sig = rooms.map(r =>
            `${r.name}|${r.members}|${r.max_members}|${r.protected}|${r.kind}`
        ).join('§');

        els.roomCount.textContent =
            `${rooms.length} room${rooms.length === 1 ? '' : 's'}`;
        els.lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString();

        if (sig !== lastRoomsSig) {
            lastRoomsSig = sig;
            renderRooms();
        }
    }

    function onRoomCreated(msg) {
        pendingCreate = false;
        els.crSubmit.disabled = false;

        const passcode = els.crPasscode.value;
        closeDialog();
        navigateToRoom(msg.room, passcode);
    }

    function onError(msg) {
        const code = msg.code || 'ERROR';
        const text = msg.message || 'Unknown error';

        // Errors while creating → show inside the dialog.
        if (pendingCreate) {
            pendingCreate = false;
            els.crSubmit.disabled = false;
            els.crError.hidden = false;
            els.crError.textContent = `${code}: ${text}`;
            return;
        }

        // General lobby errors.
        switch (code) {
            case 'RATE_LIMITED':
                const wait = Number(msg.retry_after_ms) || 250;
                showBanner('warn', `Slow down — retry in ${wait} ms.`, false, 1500);
                return;
            case 'NOT_ROOM_OWNER':
                showBanner(
                    'error',
                    text || 'Only the room creator or an admin can delete this room.',
                    false
                );
                return;
            case 'ROOM_NOT_FOUND':
                // Only reachable from delete_room in the lobby; the room is already gone.
                showBanner('warn', 'That room no longer exists.', true, 2000);
                requestRooms();
                return;
            default:
                showBanner('error', `${code}: ${text}`, true);
                return;
        }
    }

    /* ============================================================
       Room list rendering
       ============================================================ */

    function renderRooms() {
        const q = els.filter.value.trim().toLowerCase();
        const list = q ? rooms.filter(r => r.name.toLowerCase().includes(q)) : rooms.slice();

        els.rooms.replaceChildren();

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = rooms.length === 0
                ? 'No rooms yet. Be the first to create one.'
                : 'No rooms match your filter.';
            els.rooms.appendChild(empty);
            return;
        }

        list.sort((a, b) => a.name.localeCompare(b.name));
        for (const room of list) els.rooms.appendChild(roomCard(room));
    }

    function roomCard(room) {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const activate = () => handleRoomClick(room);
        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });

        const top = document.createElement('div');
        top.className = 'room-card__top';

        const name = document.createElement('div');
        name.className = 'room-card__name';
        name.textContent = room.name;
        top.appendChild(name);

        if (room.protected) {
            const lock = document.createElement('span');
            lock.className = 'badge badge--lock';
            lock.textContent = '🔒';
            lock.title = 'Password protected';
            top.appendChild(lock);
        }

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'room-card__delete';
        del.title = 'Delete room';
        del.setAttribute('aria-label', `Delete room ${room.name}`);
        del.textContent = '🗑';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRoom(room);
        });
        top.appendChild(del);

        card.appendChild(top);

        const meta = document.createElement('div');
        meta.className = 'room-card__meta';

        const kind = document.createElement('span');
        kind.className = 'badge badge--kind';
        kind.textContent = room.kind || 'custom';
        meta.appendChild(kind);

        const members = document.createElement('span');
        members.className = 'muted';
        members.textContent = `${room.members}/${room.max_members} members`;
        meta.appendChild(members);

        card.appendChild(meta);

        const created = document.createElement('div');
        created.className = 'room-card__created muted';
        created.textContent = 'Created ' + relativeTime(room.created_at);
        card.appendChild(created);

        return card;
    }

    function handleRoomClick(room) {
        if (!room || !room.name) {
            showBanner('error', 'Malformed room data from server.', false);
            return;
        }
        let passcode = '';
        if (room.protected) {
            const input = window.prompt(`Passcode for "${room.name}":`, '');
            if (input === null) return;
            passcode = input;
        }
        navigateToRoom(room.name, passcode);
    }

    function navigateToRoom(name, passcode) {
        sessionStorage.setItem('ws.pendingRoom', JSON.stringify({
            room: name,
            passcode: passcode || '',
            kind: 'chat',
        }));
        // Keep the URL params too — harmless, and useful for sharing links.
        const q = new URLSearchParams();
        q.set('room', name);
        if (passcode) q.set('passcode', passcode);
        location.href = 'chat.html?' + q.toString();
    }

    function deleteRoom(room) {
        const ok = window.confirm(
            `Delete room "${room.name}"?\n\nAll members will be removed and the room cannot be recovered.`
        );
        if (!ok) return;

        if (!send({ type: 'delete_room', room: room.name })) {
            showBanner('error', 'Not connected.', false);
            return;
        }

        // No ack comes back. Give the server a beat, then refresh the list.
        // If the delete succeeded, the room is gone; if it failed, the
        // NOT_ROOM_OWNER error banner appears and the room stays.
        setTimeout(requestRooms, 400);
    }

    function relativeTime(unixSec) {
        if (!unixSec) return 'just now';
        const now = Math.floor(Date.now() / 1000);
        const diff = Math.max(0, now - unixSec);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    /* ============================================================
       Polling
       ============================================================ */

    function requestRooms() {
        send({ type: 'list_rooms' });
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(requestRooms, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    /* ============================================================
       Create dialog
       ============================================================ */

    function openDialog() {
        els.crError.hidden = true;
        els.crError.textContent = '';
        els.createForm.reset();
        els.crSubmit.disabled = false;

        // Default the ephemeral checkbox based on the kind preset.
        syncEphemeralDefault();

        if (typeof els.dialog.showModal === 'function') {
            els.dialog.showModal();
        } else {
            els.dialog.setAttribute('open', '');
        }
        els.crName.focus();
    }

    function closeDialog() {
        if (typeof els.dialog.close === 'function') {
            els.dialog.close();
        } else {
            els.dialog.removeAttribute('open');
        }
    }

    function syncEphemeralDefault() {
        // Presets from §5.2: chat=false, game=true, custom=true.
        els.crEphemeral.checked = els.crKind.value !== 'chat';
    }

    function submitCreate() {
        const name = els.crName.value.trim();

        if (!ROOM_RE.test(name)) {
            els.crError.hidden = false;
            els.crError.textContent =
                'Invalid room name. Use 1–64 characters from a–z A–Z 0–9 _ -';
            return;
        }

        const payload = { type: 'create_room', room: name };

        const kind = els.crKind.value;
        if (kind) payload.kind = kind;

        const passcode = els.crPasscode.value;
        if (passcode) payload.passcode = passcode;

        const maxRaw = els.crMax.value.trim();
        if (maxRaw) {
            const n = parseInt(maxRaw, 10);
            if (!Number.isInteger(n) || n < 1) {
                els.crError.hidden = false;
                els.crError.textContent = 'Max members must be a positive integer.';
                return;
            }
            payload.max_members = n;
        }

        // Always send the checkbox value — an explicit `false` is meaningful.
        payload.ephemeral = els.crEphemeral.checked;

        pendingCreate = true;
        els.crError.hidden = true;
        els.crSubmit.disabled = true;

        if (!send(payload)) {
            pendingCreate = false;
            els.crSubmit.disabled = false;
            els.crError.hidden = false;
            els.crError.textContent = 'Not connected. Retrying…';
            connect();
        }
    }

    /* ============================================================
       UI helpers
       ============================================================ */

    function setStatus(kind, text) {
        els.status.className = 'status status--' + kind;
        els.statusText.textContent = text;
    }

    function showBanner(kind, text, autoHide = false, hideMs = 3000) {
        els.banner.replaceChildren();
        els.banner.dataset.kind = kind;

        const span = document.createElement('span');
        span.textContent = text;
        els.banner.appendChild(span);

        if (autoHide) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Dismiss';
            btn.addEventListener('click', hideBanner);
            els.banner.appendChild(btn);
        }
        els.banner.hidden = false;

        if (hideMs > 0) setTimeout(hideBanner, hideMs);
    }

    function hideBanner() {
        els.banner.hidden = true;
        els.banner.replaceChildren();
    }

    /* ============================================================
       Events
       ============================================================ */

    els.refresh.addEventListener('click', () => {
        els.lastUpdated.textContent = 'Refreshing…';
        requestRooms();
    });

    els.filter.addEventListener('input', renderRooms);

    els.createOpen.addEventListener('click', openDialog);

    els.createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitCreate();
    });

    els.crKind.addEventListener('change', syncEphemeralDefault);

    els.dialog.querySelectorAll('[data-close]').forEach((b) => {
        b.addEventListener('click', closeDialog);
    });

    // Close dialog on backdrop click (click on the <dialog> element itself).
    els.dialog.addEventListener('click', (e) => {
        if (e.target === els.dialog) closeDialog();
    });

    window.addEventListener('pagehide', disconnect);
})();