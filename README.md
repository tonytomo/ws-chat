# Chat Client

A small browser client for the [Universal WebSocket Server](./PROTOCOL.md).
Two pages: a lobby that lists and creates rooms, and a chat page that joins
one room and relays messages.

No build step, no dependencies. Open the files in a browser.

---

## Files

| File         | Purpose                                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| `index.html` | Lobby — lists rooms, creates rooms, deletes rooms                                |
| `lobby.js`   | Lobby logic (WebSocket, `list_rooms`, `create_room`, `delete_room`)              |
| `lobby.css`  | Lobby styles                                                                     |
| `chat.html`  | Chat room                                                                        |
| `app.js`     | Chat logic (WebSocket, `join_room`, `publish`, `delete_room`)                    |
| `styles.css` | Chat styles                                                                      |
| `config.js`  | Resolves the API key and WS endpoint, persists them, strips secrets from the URL |

---

## Getting started

### 1. Serve the files

The client must be served over HTTP — opening `index.html` from disk won't
work, because `file://` origins can't open WebSockets to your server.

Any static server will do:

```sh
python3 -m http.server 3000
```

Then visit `http://localhost:3000/`.

### 2. Bootstrap your API key

On first access, pass the key (and optionally a non-default WS endpoint)
in the URL:

```
http://localhost:3000/?key=YOUR_API_KEY
```

If your WebSocket server lives somewhere other than the same origin at
`/ws`:

```
http://localhost:3000/?key=YOUR_API_KEY&ws=wss://example.com/ws
```

`config.js` saves both values to `localStorage` and immediately rewrites
the address bar to remove them. **You only need to do this once per
origin.** After that, just visit `http://localhost:3000/`.

To reset a bad or expired key, clear the banner's "Reset key" button, or
run `window.Config.clear()` in DevTools, or wipe site data.

### 3. Use it

- **Lobby** (`index.html`) — see every active room, create a new one with
  an optional passcode, join by clicking a card, delete rooms you own.
- **Chat** (`chat.html?room=NAME`) — you normally reach this by clicking a
  card in the lobby. It joins the room, or creates it if it doesn't exist.

Protected rooms prompt for a passcode before navigating to the chat page.

---

## Configuration

Everything lives in the URL on first visit, then in `localStorage`.

| URL param  | Required          | Meaning                                                                   |
| ---------- | ----------------- | ------------------------------------------------------------------------- |
| `key`      | yes (first visit) | API key                                                                   |
| `ws`       | no                | Override the WebSocket endpoint (default: same origin, `/ws`)             |
| `room`     | chat page         | Room to join                                                              |
| `passcode` | no                | Passcode for a protected room                                             |
| `kind`     | no                | Room preset used if the room has to be created (`chat`, `game`, `custom`) |

`localStorage` keys:

- `ws.apiKey` — the API key
- `ws.endpoint` — the WS override, if any

---

## How it works

- The lobby opens a WebSocket, waits for `welcome`, then polls `list_rooms`
  every 5 seconds. The room grid only re-renders when the data actually
  changes.
- Clicking a room hands off to the chat page via `sessionStorage` (with URL
  params as a fallback for shareable links). The chat page reads the handoff,
  clears it, and joins the room.
- If the room doesn't exist, the chat page auto-creates it using the
  `kind` hint, then retries the join.
- Messages go out on the `chat` channel if the room has one, otherwise
  `default`, otherwise the first non-`presence` channel.
- `delete_room` has no ack — success is signalled by the `room_deleted`
  presence event, which the server broadcasts to all current members
  (including the deleter). The client redirects to the lobby on receipt.

See `PROTOCOL.md` for the full wire format.

---

## Troubleshooting

**"Missing API key" on the lobby**
The key was never bootstrapped on this origin. Visit `index.html?key=...`
once.

**"Connection rejected" after a key change**
The old key is still in `localStorage`. Click "Reset key" on the banner,
or run `window.Config.clear()` and reload.

**Joined the wrong room**
The chat page requires a `room` param. If it's missing, you'll get a
"no room specified" banner rather than a silent fallback.

**Storage works on `localhost` but not on my domain**
`localStorage` is per-origin. Bootstrap once per origin (`http://` and
`https://` count as different origins too).
