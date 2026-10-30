# WebSocket Chat Application

A real-time, room-based WebSocket chat client built with Svelte 5, SvelteKit, TypeScript, and Tailwind CSS. It connects to a room-oriented WebSocket server to support multi-room messaging, presence tracking, and access control.

---

## Features

- **Lobby & Room Discovery**: Browse active rooms with automatic 5-second polling, filter rooms in real time, and view live participant counts.
- **Room Presets**: Create rooms configured for different use cases:
  - `chat`: Persistent, long-lived room supporting up to 500 members.
  - `game`: Ephemeral room supporting up to 16 members.
  - `custom`: Ephemeral room supporting up to 64 members with custom limits.
- **Passcode Protection**: Create password-protected rooms with access prompts upon joining.
- **Live Chat & Presence**:
  - Real-time messaging with instant optimistic rendering for outbound messages.
  - Automatic channel negotiation (`chat`, `default`, or first non-presence channel).
  - Member join and leave notifications.
  - Handled room deletion broadcast events.
- **Connection Management**:
  - Periodic heartbeat (ping/pong every 25 seconds) with stale connection detection.
  - Graceful reconnection prompts for server restarts or network drops.
  - Built-in backoff handling for server rate-limiting (`RATE_LIMITED` / `retry_after_ms`).
- **Credential Safety**:
  - Bootstrap API keys and custom WebSocket endpoints via URL query parameters.
  - Parameters (`key`, `apikey`, `ws`) are saved to browser `localStorage` and immediately stripped from the address bar and navigation history to prevent accidental sharing.
  - Settings dialog in the lobby to inspect, update, or clear stored credentials.
- **Static SPA Architecture**: Built using `@sveltejs/adapter-static` with a `404.html` fallback, ready for deployment on GitHub Pages, Vercel, Netlify, or any static HTTP file host.

---

## Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev/) (Runes mode: `$state`, `$derived`, `$effect`, `$props`)
- **Meta-Framework**: [SvelteKit 3](https://kit.svelte.dev/) with `@sveltejs/adapter-static`
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/vite`
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Icons & Typography**: Plus Jakarta Sans & Google Material Symbols Outlined

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm (or pnpm / yarn)

### Installation

Clone the repository and install dependencies:

```sh
npm install
```

### Development Server

Start the local Vite development server:

```sh
npm run dev
```

To automatically open the app in your browser:

```sh
npm run dev -- --open
```

### Production Build

Create an optimized static build:

```sh
npm run build
```

Preview the static production build locally:

```sh
npm run preview
```

---

## Configuration & Usage

### 1. Authenticating via URL

On first visit, provide your API key (and optionally a custom WebSocket URL) as URL parameters:

```
http://localhost:5173/?key=YOUR_API_KEY
```

If your WebSocket server runs on a separate host or port from the static client:

```
http://localhost:5173/?key=YOUR_API_KEY&ws=wss://chat-backend.example.com/ws
```

The application stores these values in `localStorage` under `ws.apiKey` and `ws.endpoint`, then removes the query parameters from the browser address bar.

### 2. Managing Settings in the UI

You can click the settings icon in the top header to:

- Update the API key.
- Set or override the WebSocket endpoint URL.
- Clear stored credentials from `localStorage`.

### 3. URL Parameters Reference

| Parameter        | Route          | Description                                                                          |
| ---------------- | -------------- | ------------------------------------------------------------------------------------ |
| `key` / `apikey` | Lobby (`/`)    | API key used for authentication. Stored and scrubbed on load.                        |
| `ws`             | Lobby (`/`)    | WebSocket endpoint override. Defaults to `/ws` relative to host origin.              |
| `room`           | Chat (`/chat`) | Name of the room to join or auto-create.                                             |
| `passcode`       | Chat (`/chat`) | Passcode required when entering a protected room.                                    |
| `kind`           | Chat (`/chat`) | Fallback room preset (`chat`, `game`, `custom`) used if the room does not exist yet. |

---

## WebSocket Protocol

Communication between the client and server uses JSON messages over a WebSocket connection.

### Inbound Messages (Server &rarr; Client)

- `welcome`: Sent upon successful connection. Contains `client_id` and assigned user `label`.
- `room_list`: Returns the current list of available rooms and participant counts.
- `room_created`: Confirms room creation and lists available channels.
- `room_joined`: Confirms the client joined a room, listing active channels and member count.
- `room_left`: Confirms departure from a room.
- `message`: Broadcast payload on a specific room channel. Also used on the `presence` channel (`join`, `leave`, `room_deleted`).
- `error`: Indicates an error (`code`, `message`, optional `retry_after_ms`).
- `pong`: Response to client heartbeat ping.

### Outbound Payloads (Client &rarr; Server)

- `list_rooms`: Requests the active room list.
- `create_room`: Creates a room (`room`, `kind`, `passcode`, `max_members`, `ephemeral`, `channels`, `metadata`).
- `join_room`: Joins an existing room with optional `passcode`.
- `leave_room`: Leaves the current room.
- `delete_room`: Requests deletion of an owned room.
- `publish`: Publishes a message to a room channel (`room`, `channel`, `payload`).
- `ping`: Keepalive ping.

---

## Project Structure

```
src/
├── app.html                     # HTML document shell with web fonts
├── routes/
│   ├── +layout.svelte           # Root layout, theme setup, and config initialization
│   ├── layout.css               # Global Tailwind CSS definitions and design tokens
│   ├── +page.svelte             # Lobby page (room list, search, room creation)
│   └── chat/
│       └── +page.svelte         # Chat room page (header, feed, composer)
└── lib/
    ├── api/
    │   └── wsClient.ts          # WebSocket wrapper (lifecycle, heartbeats, reconnects)
    ├── components/
    │   ├── chat/                # Chat components (ChatFeed, ChatMessage, ChatComposer)
    │   ├── lobby/               # Lobby components (RoomCard, CreateRoomModal, KeyConfigModal)
    │   └── ui/                  # Reusable UI primitives (Button, Modal, Banner, Badge)
    ├── stores/
    │   ├── chatStore.svelte.ts  # Chat session state, messaging, presence tracking
    │   ├── configStore.svelte.ts# API key, endpoint configuration, URL sanitization
    │   └── lobbyStore.svelte.ts # Lobby room polling and room management
    ├── types/
    │   └── protocol.ts          # Protocol types, payloads, and message interfaces
    └── utils/
        ├── formatters.ts        # Relative time and date formatters
        └── validators.ts        # Room name and preset validation rules
```

---

## Available Scripts

| Command           | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `npm run dev`     | Runs the development server via Vite.                        |
| `npm run build`   | Builds static assets into the `build/` directory.            |
| `npm run preview` | Locally serves the production build.                         |
| `npm run check`   | Runs SvelteKit synchronization and TypeScript type checking. |
| `npm run lint`    | Checks code formatting with Prettier and runs ESLint.        |
| `npm run format`  | Automatically formats files using Prettier.                  |
