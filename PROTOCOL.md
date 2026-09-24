# WebSocket Wire Protocol Reference

This document defines the wire protocol for the Universal WebSocket Server. It serves as the authoritative reference for client implementers and contributors.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Connecting](#2-connecting)
  - [2.1 Transport and Handshake](#21-transport-and-handshake)
  - [2.2 Authentication Flow](#22-authentication-flow)
  - [2.3 The Welcome Message](#23-the-welcome-message)
- [3. Client → Server Messages](#3-client--server-messages)
  - [3.1 create_room](#31-create_room)
  - [3.2 join_room](#32-join_room)
  - [3.3 leave_room](#33-leave_room)
  - [3.4 list_rooms](#34-list_rooms)
  - [3.5 publish](#35-publish)
  - [3.6 send (Deprecated)](#36-send-deprecated)
  - [3.7 ping](#37-ping)
- [4. Server → Client Messages](#4-server--client-messages)
  - [4.1 welcome](#41-welcome)
  - [4.2 room_created](#42-room_created)
  - [4.3 room_joined](#43-room_joined)
  - [4.4 room_left](#44-room_left)
  - [4.5 room_list](#45-room_list)
  - [4.6 message](#46-message)
  - [4.7 error](#47-error)
  - [4.8 pong](#48-pong)
- [5. Channels](#5-channels)
  - [5.1 Room and Channel Topology](#51-room-and-channel-topology)
  - [5.2 Room Kind Presets](#52-room-kind-presets)
  - [5.3 Permissions and Channel Writable Status](#53-permissions-and-channel-writable-status)
  - [5.4 Delivery Semantics (Reliable vs. Unreliable Lanes)](#54-delivery-semantics-reliable-vs-unreliable-lanes)
  - [5.5 Rate Limiting and Disconnection Thresholds](#55-rate-limiting-and-disconnection-thresholds)
  - [5.6 Binary Channel ID Negotiation](#56-binary-channel-id-negotiation)
- [6. Presence](#6-presence)
  - [6.1 Event Format and Triggers](#61-event-format-and-triggers)
  - [6.2 Timing Guarantees](#62-timing-guarantees)
  - [6.3 Reconnection Behavior](#63-reconnection-behavior)
- [7. Binary Frames](#7-binary-frames)
  - [7.1 Wire Encoding](#71-wire-encoding)
  - [7.2 Channel Declaration and Routing](#72-channel-declaration-and-routing)
  - [7.3 Unmapped Channels and Strike Thresholds](#73-unmapped-channels-and-strike-thresholds)
- [8. Configuration Reference](#8-configuration-reference)
- [9. Operational Notes](#9-operational-notes)
  - [9.1 Health Endpoints](#91-health-endpoints)
  - [9.2 Graceful Shutdown](#92-graceful-shutdown)
  - [9.3 Prometheus Telemetry](#93-prometheus-telemetry)
- [10. Versioning](#10-versioning)

---

## 1. Overview

The Universal WebSocket Server is a multi-room, multi-channel message relay written in Go using `github.com/coder/websocket`. It is designed for low-latency browser gaming, chat, and collaborative tools. It is **not** an authoritative application server: it does not validate application-level state transitions, execute game physics, or parse arbitrary payload internals. It is **not** a persistence layer: all rooms, memberships, and counters reside in memory and do not survive a server restart.

- **Transport**: Standard WebSocket protocol over `GET /ws`.
- **Authentication**: API keys validated prior to protocol upgrade via query parameter (`?key=...`) or `Authorization: Bearer <key>` HTTP header.
- **Envelope Convention**: All text frames are JSON objects containing a `"type"` string field.
- **Binary Frames**: Binary WebSocket frames bypass JSON serialization and prefix a 1-byte channel identifier before raw bytes (see [§7](#7-binary-frames)).
- **Version Reporting**: The server reports its running software version in the `welcome` message via `server_version` (see [§2.3](#23-the-welcome-message)).

---

## 2. Connecting

### 2.1 Transport and Handshake

Clients initiate connection via HTTP `GET` to the `/ws` endpoint. The server verifies allowed origins (`ALLOWED_ORIGINS`, default `*`) and negotiates the WebSocket upgrade using RFC 6455 standards.

If you connect with an HTTP method other than `GET`, the server immediately terminates the request with `HTTP 405 Method Not Allowed`.

### 2.2 Authentication Flow

The server extracts the API key using one of two methods:

1. **Authorization Header (Standard HTTP / Server-to-Server)**:
   ```http
   GET /ws HTTP/1.1
   Host: localhost:8080
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
   Sec-WebSocket-Version: 13
   Authorization: Bearer k_alice_abc123xyz
   ```

2. **Query Parameter (Browser Native `WebSocket` API)**:
   ```http
   GET /ws?key=k_alice_abc123xyz HTTP/1.1
   Host: localhost:8080
   Upgrade: websocket
   Connection: Upgrade
   Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
   Sec-WebSocket-Version: 13
   ```

The Authorization header takes precedence if both are supplied.

#### Rejection on Authentication Failure (HTTP 401)
If the key is missing, empty, or does not match any entry in the loaded key registry, the handshake is aborted **before** WebSocket protocol upgrade completes:
- HTTP Status: `401 Unauthorized`
- Body: `Unauthorized: invalid or missing API key`
- The metric counter `websocket_auth_failures_total` is incremented.
- No WebSocket connection is opened.

### 2.3 The Welcome Message

Upon a successful upgrade, the server immediately and synchronously transmits a `welcome` message on the connection prior to executing the message read loop:

```json
{
  "type": "welcome",
  "client_id": "8f88cb04-b97c-48c0-bc9a-bc04e6c38b25",
  "label": "alice",
  "server_version": "1.0.0"
}
```

Fields:
- `type` (string): Fixed value `"welcome"`.
- `client_id` (string): UUIDv4 assigned to this individual WebSocket connection instance.
- `label` (string): Human-readable identity mapped to the API key from `keys.json` (e.g., `"alice"`), or `"env-key-N"` if using the legacy `API_KEYS` environment variable.
- `server_version` (string): Current server build version, configured via `SERVER_VERSION` (default `"1.0.0"`).

---

## 3. Client → Server Messages

Every inbound message sent over the text (JSON) lane must be a JSON object containing a `type` string.

> [!NOTE]
> The message type `hello` is **not implemented** in the server. Sending `{"type": "hello"}` results in an error (`BAD_REQUEST: unrecognized message type "hello"`).

### 3.1 create_room

Instructs the hub to provision a new room with specific channel rules, capacity, and privacy settings.

```json
{
  "type": "create_room",
  "room": "arena-1",
  "kind": "game",
  "passcode": "secret123",
  "max_members": 16,
  "ephemeral": true,
  "channels": {
    "state": { "reliable": false, "max_rate": 60 },
    "chat": { "reliable": true, "max_rate": 5 }
  },
  "metadata": {
    "map": "desert_strike",
    "mode": "deathmatch"
  }
}
```

#### Fields
- `room` (string, required): Room name.
  - Length: 1–64 characters.
  - Allowed characters: `[a-zA-Z0-9_-]`.
- `kind` (string, optional, default: `"custom"`): Room template.
  - Accepted values: `"chat"`, `"game"`, `"custom"`.
  - Sets preset channel definitions, default member capacity, and default ephemeral behavior when not explicitly overridden (see [§5.2](#52-room-kind-presets)).
- `passcode` (string, optional, default: `""`): Room access password. When non-empty, hashed using bcrypt (`bcrypt.DefaultCost`).
- `max_members` (integer, optional, default: preset default): Maximum concurrent members. Effective capacity is capped by `effective_max = min(requested_max, MAX_MEMBERS_PER_ROOM)` where `requested_max` is the explicit field or kind preset default. If `MAX_MEMBERS_PER_ROOM <= 0`, global cap is disabled.
- `ephemeral` (boolean, optional, default: resolved from env/preset): Lifecycle deletion behavior. Precedence: explicit field in `create_room` > `EPHEMERAL_ROOMS` env var > kind preset default (`chat: false`, `game: true`, `custom: true`).
- `channels` (object, optional, default: preset channels): Map of channel definitions overriding or augmenting the preset.
  - Key: Channel name. Length 1–32 characters, regex `^[a-zA-Z0-9_-]{1,32}$`. Name `"presence"` is reserved.
  - Value object:
    - `reliable` (boolean, optional, default: `true`): Delivery reliability lane.
    - `max_rate` (integer, optional, default: `0`): Token-bucket rate limit in messages per second per connection. `0` indicates unlimited.
- `metadata` (arbitrary JSON, optional): Custom metadata stored on the room and exposed in `list_rooms`.

#### Server Response
- Success: Emits [`room_created`](#42-room_created) to the creator.
- Triggered presence events: None. Creating a room does not join the creator to the room.

#### Errors Produced
- `FORBIDDEN_SCOPE`: API key lacks the `room:create` (or `room:admin`) scope.
- `BAD_REQUEST`: Missing `room`, invalid room name syntax, invalid channel name syntax, or unparseable input.
- `RESERVED_CHANNEL_NAME`: The `channels` object specifies `"presence"`.
- `ROOM_ALREADY_EXISTS`: A room with this name already exists in the store.
- `MAX_ROOMS_REACHED`: Server has reached the global `MAX_ROOMS` allocation limit.

---

### 3.2 join_room

Adds the client connection to an existing room and binds any declared binary channel mappings.

```json
{
  "type": "join_room",
  "room": "arena-1",
  "passcode": "secret123",
  "binary_channels": {
    "state": 1,
    "actions": 2
  }
}
```

#### Fields
- `room` (string, required): Name of target room.
- `passcode` (string, optional, default: `""`): Candidate passcode if room is password-protected.
- `binary_channels` (object, optional): Map of channel names to 1-byte binary identifiers (`uint8`).
  - Channel name must exist in the target room.
  - Channel name `"presence"` cannot be mapped to binary (`RESERVED_CHANNEL_NAME`).
  - Identifier `0` is reserved for JSON control frames (`BAD_REQUEST`).
  - Identifier `255` is reserved for presence events (`RESERVED_CHANNEL_NAME`).
  - Range: `1` to `254`.
  - Duplicate assignments within the same join message produce `BAD_REQUEST`.

#### Server Response
- To Joining Client: Sends [`room_joined`](#43-room_joined).
- To Other Members: Broadcasts a server [`message`](#46-message) on the `presence` channel with event `"join"`. The joining client does **not** receive this event. If the client is the first member in the room, no presence event is emitted.
- Re-joining: If the client is already a member of the room, binary mappings are updated, [`room_joined`](#43-room_joined) is returned, and no duplicate presence event is emitted.

#### Errors Produced
- `FORBIDDEN_SCOPE`: API key lacks the `room:join` (or `room:admin`) scope.
- `BAD_REQUEST`: Missing room name, invalid binary channel ID (0), duplicate channel ID assignment, or channel does not exist in the room.
- `ROOM_NOT_FOUND`: Target room does not exist.
- `RESERVED_CHANNEL_NAME`: Binary channel mapped to `"presence"` or ID `255`.
- `INVALID_PASSCODE`: Passcode does not match the room's bcrypt hash.
- `PASSCODE_RATE_LIMITED`: Too many consecutive failed passcode attempts. Client is locked out for `PASSCODE_LOCKOUT_PERIOD`.
- `ROOM_FULL`: Current member count has reached the room's effective capacity (`room "<room>" is at capacity (<current>/<max>)`). The client connection remains open.
- `INTERNAL_ERROR`: Internal room join failure.

---

### 3.3 leave_room

Removes the client connection from an active room.

```json
{
  "type": "leave_room",
  "room": "arena-1"
}
```

#### Fields
- `room` (string, required): Name of the room to leave.

#### Server Response
- To Leaving Client: Sends [`room_left`](#44-room_left).
- To Remaining Members: Broadcasts a server [`message`](#46-message) on the `presence` channel with event `"leave"` if remaining member count > 0.
- Room Cleanup: If the room is configured as `ephemeral: true` and the remaining member count drops to 0, the hub immediately deletes the room from memory.

#### Errors Produced
- `BAD_REQUEST`: Missing room name, or client is not currently a member of the room.
- `ROOM_NOT_FOUND`: Room does not exist.
- `INTERNAL_ERROR`: Internal departure failure.

---

### 3.4 list_rooms

Requests an inventory of all active rooms currently registered in the hub.

```json
{
  "type": "list_rooms"
}
```

#### Fields
- None.

#### Server Response
- Returns [`room_list`](#45-room_list).

#### Errors Produced
- None.

---

### 3.5 publish

Publishes a JSON payload to a specific channel within a joined room.

```json
{
  "type": "publish",
  "room": "arena-1",
  "channel": "chat",
  "reliable": true,
  "payload": {
    "text": "Hello world!"
  },
  "include_sender": false
}
```

#### Fields
- `room` (string, required): Target room name.
- `channel` (string, optional, default: `"default"`): Destination channel name.
  - Length: 1–32 characters, regex `^[a-zA-Z0-9_-]{1,32}$`.
  - Cannot be `"presence"` (presence is server-only).
- `payload` (arbitrary JSON, optional): Raw JSON value (object, array, number, boolean, or string) forwarded to subscribers.
- `reliable` (boolean, optional, default: channel's configured `reliable` setting):
  - When omitted, inherits the channel's default reliability.
  - **Constraint**: If the channel is configured with `reliable: false`, setting `reliable: true` is forbidden and rejected with `CHANNEL_NOT_RELIABLE`.
- `include_sender` (boolean, optional, default: `false`): When `true`, the broadcast is reflected back to the publisher. When `false`, the publisher is skipped during distribution.

#### Server Response
- Server wraps payload in a [`message`](#46-message) broadcast envelope, assigns a monotonic sequence number, and enqueues the message to room members.

#### Errors Produced
- `FORBIDDEN_SCOPE`: API key lacks the `room:join` scope.
- `BAD_REQUEST`: Missing room name, invalid channel name syntax, or client is not a member of the room.
- `CHANNEL_READ_ONLY`: Client attempted to publish to `"presence"`.
- `ROOM_NOT_FOUND`: Room does not exist.
- `CHANNEL_NOT_FOUND`: Channel does not exist in the room.
- `CHANNEL_NOT_RELIABLE`: Requested reliable delivery on an unreliable-only channel.
- `RATE_LIMITED`: Publishing exceeded channel token-bucket `max_rate`. Returns `retry_after_ms: 250`. If violations exceed `MAX_RATE_VIOLATIONS_PER_MINUTE`, connection is forcibly closed.
- `INTERNAL_ERROR`: Internal broadcast dispatch failure.

---

### 3.6 send (Deprecated)

A legacy backward-compatibility alias for `publish`.

```json
{
  "type": "send",
  "room": "arena-1",
  "payload": {
    "event": "player_ready"
  }
}
```

#### Behavior & Translation
When the server receives `send`:
1. The server logs a warning once per connection: `client used deprecated 'send' message type; use 'publish' instead`.
2. Translates the message into:
   - `channel`: `"default"`
   - `reliable`: `true`
3. Dispatches the request via the standard `publish` message handler.

**Deprecation Notice**: Deprecated following the introduction of multi-channel routing. Existing code continues to function if the target room possesses a `"default"` channel configured as reliable. All modern clients must migrate to `publish`.

---

### 3.7 ping

Client-initiated application-level heartbeat.

```json
{
  "type": "ping"
}
```

#### Fields
- None.

#### Server Response
- Server replies immediately with [`pong`](#48-pong).

#### Errors Produced
- None.

---

## 4. Server → Client Messages

### 4.1 welcome

Sent synchronously to the client immediately following WebSocket protocol upgrade. Documented in detail in [§2.3](#23-the-welcome-message).

```json
{
  "type": "welcome",
  "client_id": "3f42c235-96c2-4581-b89b-bd15ba242d84",
  "label": "alice",
  "server_version": "1.0.0"
}
```

---

### 4.2 room_created

Notifies the client that room creation succeeded.

```json
{
  "type": "room_created",
  "room": "arena-1",
  "channels": ["actions", "chat", "presence", "state"]
}
```

#### Fields
- `type` (string): Fixed value `"room_created"`.
- `room` (string): Name of the created room.
- `channels` (array of strings): Sorted list of all active channel names configured in the room, including the auto-provisioned `"presence"` channel.

---

### 4.3 room_joined

Confirms that the client has been admitted to the room.

```json
{
  "type": "room_joined",
  "room": "arena-1",
  "channels": ["actions", "chat", "presence", "state"],
  "members": 2
}
```

#### Fields
- `type` (string): Fixed value `"room_joined"`.
- `room` (string): Name of the joined room.
- `channels` (array of strings): Sorted list of active channel names available in the room.
- `members` (integer): Total count of connected members currently in the room (including the joining client).

---

### 4.4 room_left

Confirms the client's departure from a room.

```json
{
  "type": "room_left",
  "room": "arena-1"
}
```

#### Fields
- `type` (string): Fixed value `"room_left"`.
- `room` (string): Name of the room departed.

---

### 4.5 room_list

Returns active rooms in response to a `list_rooms` query.

```json
{
  "type": "room_list",
  "rooms": [
    {
      "name": "arena-1",
      "members": 2,
      "protected": true,
      "kind": "game",
      "channels": ["actions", "chat", "presence", "state"],
      "channel_configs": {
        "actions": { "name": "actions", "reliable": true, "max_rate": 20 },
        "chat": { "name": "chat", "reliable": true, "max_rate": 5 },
        "presence": { "name": "presence", "reliable": true, "max_rate": 0 },
        "state": { "name": "state", "reliable": false, "max_rate": 60 }
      },
      "max_members": 16,
      "created_at": 1773752400,
      "metadata": { "map": "desert_strike" }
    }
  ]
}
```

#### Fields
- `rooms` (array of objects): List of room summaries.
  - `name` (string): Room identifier.
  - `members` (integer): Current member count.
  - `protected` (boolean): `true` if protected by passcode, otherwise `false`.
  - `kind` (string): Room preset type (`"chat"`, `"game"`, or `"custom"`).
  - `channels` (array of strings): Sorted list of channel names in the room.
  - `channel_configs` (object, optional): Map of detailed channel configurations. **Omitted** unless the querying client's key label matches the room creator's label (`CreatedBy`).
  - `max_members` (integer): Maximum capacity.
  - `created_at` (int64): Room creation timestamp in **Unix epoch seconds**.
  - `metadata` (arbitrary JSON): User-supplied metadata passed during creation.

---

### 4.6 message

The broadcast envelope forwarded to room subscribers.

```json
{
  "type": "message",
  "room": "arena-1",
  "channel": "chat",
  "from": "alice",
  "seq": 1,
  "ts": 1773752405,
  "payload": {
    "text": "Hello world!"
  }
}
```

#### Envelope Fields and Semantics
- `type` (string): Fixed value `"message"`.
- `room` (string): Name of originating room.
- `channel` (string): Name of originating channel (`"chat"`, `"state"`, `"presence"`, etc.).
- `from` (string): Identity of sender:
  - For peer messages: Sender's API key label (e.g., `"alice"`, `"bob"`).
  - For presence messages: Literal sentinel value `"server"`.
- `seq` (uint64): Monotonically increasing sequence number.
  - **Scope**: Evaluated independently per `(room, channel)` combination.
  - **Lifecycle**: Starts at `1` on the first message published to that channel. If an ephemeral room is destroyed and recreated under the same name, its sequence counters reset to `1`.
- `ts` (int64): Server timestamp in **Unix epoch seconds** (`time.Now().Unix()`).
- `payload` (arbitrary JSON): Inner payload. For peer broadcasts, represents client data verbatim. For presence broadcasts, contains the structured presence event payload (see [§6](#6-presence)).

---

### 4.7 error

Structured error response emitted when an action fails.

```json
{
  "type": "error",
  "code": "RATE_LIMITED",
  "message": "rate limit exceeded; please slow down",
  "channel": "state",
  "retry_after_ms": 250
}
```

#### Fields
- `type` (string): Fixed value `"error"`.
- `code` (string): Stable error code identifier (see table below).
- `message` (string): Human-readable error description.
- `channel` (string, optional): Relevant channel identifier for channel-specific faults.
- `retry_after_ms` (integer, optional): Recommended backoff interval in milliseconds (present on `RATE_LIMITED`).

#### Complete Error Code Reference

| Error Code | Trigger Condition | Connection Survives? |
|---|---|---|
| `UNAUTHORIZED` | Invalid or missing API key at HTTP upgrade. Rejected as HTTP 401. (Defined in protocol symbols; not emitted as a WebSocket frame). | No (Upgrade rejected) |
| `FORBIDDEN_SCOPE` | Key lacks required scope (`room:create` or `room:join`). | Yes |
| `BAD_REQUEST` | Malformed JSON, missing room, invalid name syntax, duplicate binary IDs, or binary ID 0. | Yes |
| `ROOM_NOT_FOUND` | Specified room does not exist. | Yes |
| `ROOM_ALREADY_EXISTS` | Attempted to create a room name that is already active. | Yes |
| `ROOM_FULL` | Room capacity limit (`effective_max = min(requested_max, MAX_MEMBERS_PER_ROOM)`) has been reached. Message format: `room "<room>" is at capacity (<current>/<max>)`. | Yes |
| `INVALID_PASSCODE` | Candidate passcode does not match bcrypt hash. | Yes |
| `PASSCODE_RATE_LIMITED` | Too many failed passcode attempts within `PASSCODE_LOCKOUT_PERIOD`. | Yes |
| `MAX_ROOMS_REACHED` | Hub reached the global `MAX_ROOMS` allocation threshold. | Yes |
| `BINARY_NOT_ALLOWED` | Server has set `ALLOW_BINARY=false`. | Yes (Up to 4 strikes; closed on 5th strike) |
| `CHANNEL_NOT_RELIABLE` | Client published with `reliable: true` on an unreliable-only channel. | Yes |
| `CHANNEL_NOT_FOUND` | Specified channel does not exist in the target room. | Yes |
| `RESERVED_CHANNEL_NAME` | Attempted to create or map `"presence"`, or use binary ID `255`. | Yes |
| `CHANNEL_READ_ONLY` | Client attempted to publish JSON or binary message to `"presence"`. | Yes |
| `RATE_LIMITED` | Token-bucket rate limit exceeded for the channel. | Yes (Unless violations exceed `MAX_RATE_VIOLATIONS_PER_MINUTE`) |
| `INTERNAL_ERROR` | Internal server execution error. | Yes |

---

### 4.8 pong

Replies to a client `{"type": "ping"}` frame.

```json
{
  "type": "pong"
}
```

---

## 5. Channels

### 5.1 Room and Channel Topology

A room acts as an administrative boundary for members. Within a room, communication is split into distinct named **channels**. A channel dictates:
1. **Delivery Guarantee**: Reliable (ordered, connection terminating on overflow) or Unreliable (lossy, drop-oldest).
2. **Throughput Limit**: Per-connection token bucket rate limiting (`max_rate`).
3. **Binary Identifier**: Optional 1-byte mapping for compact transmission.

Room members automatically subscribe to all channels configured in that room.

### 5.2 Room Kind Presets

When creating a room, specifying `kind` populates default channels, member limits, and lifecycle settings if omitted:

| Setting / Channel | `"chat"` Preset | `"game"` Preset | `"custom"` Preset (Default) |
|---|---|---|---|
| **Default `max_members`** | `500` | `16` | `64` |
| **Default `ephemeral`** | `false` | `true` | `true` |
| **Channel `state`** | — | Unreliable, 60 msgs/s | — |
| **Channel `chat`** | Reliable, 5 msgs/s | Reliable, 5 msgs/s | — |
| **Channel `actions`** | — | Reliable, 20 msgs/s | — |
| **Channel `default`** | — | — | Reliable, Unlimited (`max_rate: 0`) |
| **Channel `presence`** | Reliable, Unlimited | Reliable, Unlimited | Reliable, Unlimited |

`presence` is automatically provisioned for all room kinds.

### 5.3 Permissions and Channel Writable Status

- **Client-Writable Channels**: Standard application channels (`"chat"`, `"state"`, `"actions"`, `"default"`, and any custom channels declared at creation). Room members can publish to these channels.
- **Server-Only Channels**: The `"presence"` channel is strictly reserved for server-emitted events. If a client publishes to `"presence"`, the message is rejected with `CHANNEL_READ_ONLY` and the connection survives.

### 5.4 Delivery Semantics (Reliable vs. Unreliable Lanes)

Each client connection manages two separate outbound FIFO send queues:

```
                  ┌──────────────────────────────┐
                  │      Client Send Manager     │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌──────────────────┐                           ┌──────────────────┐
│  Reliable Queue  │                           │ Unreliable Queue │
│ (default cap:256)│                           │ (default cap: 16)│
└────────┬─────────┘                           └────────┬─────────┘
         │                                               │
         │ [Queue Full]                                  │ [Queue Full]
         ▼                                               ▼
Terminate connection                           Drop oldest message;
(StatusPolicyViolation: 1008)                  Enqueue newest message;
                                               Keep connection open
```

1. **Reliable Lane (`reliable: true`)**:
   - Used for chat, actions, control messages, and presence.
   - Channel buffer capacity configured via `RELIABLE_QUEUE_SIZE` (default `256`).
   - Write loop prioritizes this lane before reading unreliable queues.
   - **Overflow Behavior**: If a slow client fails to drain its buffer and the queue fills up, the server terminates the connection with WebSocket status `1008` (`StatusPolicyViolation`) and reason `"reliable queue overflow"`.

2. **Unreliable Lane (`reliable: false`)**:
   - Used for high-frequency game position updates (`state`).
   - Channel buffer capacity configured via `UNRELIABLE_QUEUE_SIZE` (default `16`).
   - **Overflow Behavior**: If the queue fills up, the oldest message in the queue is discarded to accommodate the new message. The connection remains open. Discarded frames increment the metric `websocket_dropped_unreliable_total`.

### 5.5 Rate Limiting and Disconnection Thresholds

Rate limiting is enforced per-connection, per-channel using a token-bucket limiter (`golang.org/x/time/rate`):
- **Rate**: `max_rate` tokens per second.
- **Burst Capacity**: `max(2, max_rate * 2)`.
- If `max_rate == 0`, rate limiting is disabled.

When a client exceeds the available burst tokens:
1. The message is dropped.
2. The server responds with `RATE_LIMITED` (`retry_after_ms: 250`).
3. The server records a violation timestamp in a sliding 1-minute window.
4. **Abuse Disconnection**: If the number of rate violations within 60 seconds exceeds `MAX_RATE_VIOLATIONS_PER_MINUTE` (default `60`), the server forcibly terminates the connection with WebSocket status `1008` (`StatusPolicyViolation`) and reason `"rate limit abuse"`.

### 5.6 Binary Channel ID Negotiation

Clients assign 1-byte identifiers to channels during `join_room` via `binary_channels`:
- Valid range: `1` to `254`.
- ID `0` is reserved for control frames.
- ID `255` is reserved for presence.
- Channel `"presence"` cannot be assigned a binary channel ID.

---

## 6. Presence

The server manages room presence automatically on the reserved `"presence"` channel.

### 6.1 Event Format and Triggers

Presence events are delivered as standard `message` broadcast envelopes where:
- `channel`: `"presence"`
- `from`: `"server"`
- `payload`: A JSON object matching:

```json
{
  "event": "join",
  "who": "alice"
}
```

Fields:
- `event` (string): Either `"join"` or `"leave"`.
- `who` (string): The authenticated API key label of the client.

#### Trigger Rules
- `"join"`: Triggered when a client successfully executes `join_room`.
- `"leave"`: Triggered when a client explicitly sends `leave_room`, abruptly terminates the socket, fails a ping heartbeat, or is evicted due to a reliable buffer overflow.

### 6.2 Timing Guarantees

- **Join Order**: The server transmits `room_joined` to the joining client **before** broadcasting the `join` presence event to the rest of the room.
- **Self-Exclusion**: A client never receives a `join` event for its own arrival. If a client joins an empty room (members <= 1), no presence event is emitted.
- **Departure Processing**: When a socket disconnects, the server executes `LeaveAllRooms`, decrements room member counts, and emits a `"leave"` presence event to remaining peers before closing room resources.

### 6.3 Reconnection Behavior

If a client abruptly disconnects and immediately rejoins:
1. Peers observe a `leave` event when the original connection terminates.
2. Peers observe a `join` event when the client establishes a new connection and calls `join_room`.
3. Events are sequenced monotonically via the `seq` counter on the room's `"presence"` channel.

---

## 7. Binary Frames

### 7.1 Wire Encoding

Binary frames provide zero-copy, compact payload transmission. The wire format is:

```
+-------------------+---------------------------------------------+
| Channel ID (1B)   | Opaque Payload (N Bytes)                    |
| uint8: 1..254     | 0 to MAX_MESSAGE_BYTES - 1                  |
+-------------------+---------------------------------------------+
```

### 7.2 Channel Declaration and Routing

1. The client declares mappings in `join_room`:
   ```json
   { "binary_channels": { "state": 1 } }
   ```
2. When the client transmits a binary frame starting with byte `0x01`, the server inspects byte 0, determines that `0x01` maps to `"state"`, and routes the entire frame (including the prefix byte) to room peers.
3. **Filtering**: Only peers who mapped channel `"state"` to the **identical** binary ID `0x01` receive the frame.
4. The sender is excluded from binary broadcasts.
5. The frame is dispatched using the reliability lane configured on that channel (e.g. unreliable for `"state"`).

### 7.3 Unmapped Channels and Strike Thresholds

- **Unknown Channel ID**: If a client sends a binary frame with an undeclared channel ID, the server drops the frame and increments `websocket_binary_unknown_channel_total`. The connection survives.
- **Server Disabled (`ALLOW_BINARY=false`)**: If the server has disabled binary processing:
  - Each binary frame generates an error: `{"type":"error","code":"BINARY_NOT_ALLOWED","message":"binary frames are disabled on this server"}`.
  - The server tracks strikes. On the 5th binary frame (`strikes >= 5`), the connection is terminated with WebSocket status `1008` (`StatusPolicyViolation`) and reason `"binary not allowed"`.
- **Channel 255 / Presence**: Binary transmission to channel ID `255` or mapping `"presence"` generates a `CHANNEL_READ_ONLY` error.

---

## 8. Configuration Reference

All settings are read from environment variables or an optional `.env` file at server startup.

| Environment Variable | Default Value | Meaning | Required |
|---|---|---|---|
| `PORT` | `8080` | HTTP and WebSocket listening port. | Optional |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed WebSocket origin patterns. | Optional |
| `PING_INTERVAL` | `30s` | Frequency of server-initiated ping heartbeats. | Optional |
| `READ_TIMEOUT` | `60s` | Maximum wait time for client pong response to server ping heartbeats. When exceeded, the connection is closed with status 1008 (`StatusPolicyViolation`, "read timeout"). Must be greater than `PING_INTERVAL`. | Optional |
| `WRITE_TIMEOUT` | `5s` | Context timeout for writing frames to the connection. | Optional |
| `MAX_MESSAGE_BYTES` | `65536` | Maximum allowed payload size per frame (64 KiB). | Optional |
| `MAX_ROOMS` | `1000` | Maximum number of active rooms allowed in memory. | Optional |
| `MAX_MEMBERS_PER_ROOM` | `100` | Authoritative global cap ceiling on room capacity (`effective_max = min(requested_max, cfg.MaxMembersPerRoom)`). Set to `0` or negative for no global ceiling. | Optional |
| `EPHEMERAL_ROOMS` | `""` (unset) | Optional global override for room lifecycle. Overrides kind preset defaults (`chat: false`, `game: true`, `custom: true`). If unset, preset defaults apply. Explicit `ephemeral` in `create_room` always takes highest precedence. | Optional |
| `ALLOW_BINARY` | `true` | When `false`, rejects binary frames with `BINARY_NOT_ALLOWED`. | Optional |
| `RELIABLE_QUEUE_SIZE` | `256` | Capacity of per-connection reliable outbound send queue. | Optional |
| `UNRELIABLE_QUEUE_SIZE` | `16` | Capacity of per-connection unreliable outbound send queue. | Optional |
| `MAX_RATE_VIOLATIONS_PER_MINUTE` | `60` | Maximum rate limit violations allowed per minute before disconnect. | Optional |
| `PASSCODE_MAX_ATTEMPTS` | `5` | Maximum failed passcode attempts before temporary lockout. | Optional |
| `PASSCODE_LOCKOUT_PERIOD` | `1m` | Lockout duration following repeated passcode failures. | Optional |
| `API_KEYS_FILE` | `""` | Path to JSON file containing API keys and labels (e.g., `keys.json`). Preferred auth source. | Required if `API_KEYS` is unset |
| `API_KEYS` | `""` | Comma-separated list of bare API keys (legacy auth source). Generates labels `env-key-1`, `env-key-2`, etc. | Required if `API_KEYS_FILE` is unset |
| `SERVER_VERSION` | `1.0.0` | Version string emitted in `welcome` messages. | Optional |
| `LOG_LEVEL` | `info` | Logging verbosity: `"debug"` or `"info"`. | Optional |

---

## 9. Operational Notes

### 9.1 Health Endpoints

- **`GET /healthz`**: Liveness probe. Always returns HTTP `200 OK` with body `{"status":"ok"}`.
- **`GET /readyz`**: Readiness probe. Checks if the key registry contains at least one active key. Returns HTTP `200 OK` with `{"status":"ready"}` if keys are loaded; otherwise returns HTTP `503 Service Unavailable` with `{"status":"not_ready"}`.

### 9.2 Graceful Shutdown

Upon intercepting `SIGINT` (Ctrl+C) or `SIGTERM`:
1. The server closes all active client WebSockets with status code `1001` (`StatusGoingAway`) and reason `"Server shutting down"`.
2. As clients close, the hub processes room departure logic and emits `"leave"` presence events to remaining members.
3. The HTTP server listener shuts down with a 10-second context deadline (`server.Shutdown`), allowing in-flight frames to drain.

### 9.3 Prometheus Telemetry

Scraped via HTTP `GET /metrics`. Metric symbols:
- `websocket_connected_clients`: Current active connections partitioned by label `key_label`.
- `websocket_rooms_total`: Current count of active rooms in memory.
- `websocket_messages_received_total`: Counter partitioned by frame type (`"json"`, `"binary"`).
- `websocket_messages_sent_total`: Counter partitioned by type (`"broadcast"`, `"binary"`).
- `websocket_auth_failures_total`: Total rejected connection upgrade attempts.
- `websocket_passcode_failures_total`: Total failed room passcode verifications.
- `websocket_dropped_unreliable_total`: Unreliable frames dropped on queue overflow (`room`, `channel`, `client_id`).
- `websocket_rate_limited_total`: Messages dropped due to rate limiting (`room`, `channel`).
- `websocket_binary_unknown_channel_total`: Binary frames dropped due to missing channel mappings.

---

## 10. Versioning

- **Protocol Wire Format**: There is no protocol version negotiation in the handshake or message envelope. Breaking wire format changes will be documented in release notes and changelogs.
- **Server Version**: The running server exposes its version string in the `server_version` field of the `welcome` message (e.g., `"1.0.0"`). This value can be customized at runtime using the `SERVER_VERSION` environment variable.
