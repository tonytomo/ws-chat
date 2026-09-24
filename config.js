// config.js — resolves the API key and WS endpoint, persists them, strips secrets from URL.
window.Config = (function () {
    'use strict';

    const KEY_STORE = 'ws.apiKey';
    const WS_STORE = 'ws.endpoint';

    const params = new URLSearchParams(location.search);

    const urlKey = (params.get('key') || params.get('apikey') || '').trim();
    const urlWs = (params.get('ws') || '').trim();

    // URL params are the bootstrap path — persist them when present.
    if (urlKey) localStorage.setItem(KEY_STORE, urlKey);
    if (urlWs) localStorage.setItem(WS_STORE, urlWs);

    const apiKey = urlKey || localStorage.getItem(KEY_STORE) || '';
    const wsOverride = urlWs || localStorage.getItem(WS_STORE) || '';

    // Scrub secrets from the address bar. The other query params (room, passcode…)
    // stay so the current page keeps working on reload.
    if (urlKey || urlWs) {
        params.delete('key');
        params.delete('apikey');
        params.delete('ws');
        const qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }

    return {
        apiKey,
        wsOverride,
        hasKey: Boolean(apiKey),
        clear() {
            localStorage.removeItem(KEY_STORE);
            localStorage.removeItem(WS_STORE);
        },
    };
})();