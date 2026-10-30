import { WSClient } from '#lib/api/wsClient';
import { configStore } from '#lib/stores/configStore.svelte';
import type {
	BannerState,
	ChatFeedItem,
	ConnectionStatus,
	InboundMessage,
	PresencePayload,
	RoomKind
} from '#lib/types/protocol';

export function createChatStore() {
	let wsClient: WSClient | null = null;
	let roomName = $state<string>('');
	let passcode = $state<string>('');
	let roomKind = $state<RoomKind>('chat');

	let status = $state<ConnectionStatus>('disconnected');
	let statusText = $state<string>('Disconnected');
	let isOnline = $state<boolean>(false);
	let selfLabel = $state<string>('');
	let memberCount = $state<number>(0);
	let messages = $state<ChatFeedItem[]>([]);
	let banner = $state<BannerState | null>(null);

	let isDeleting = $state<boolean>(false);
	let rateLimitedUntil = $state<number>(0);

	let pendingJoin = false;
	let creatingRoom = false;
	let deletingRoom = false;
	let bannerTimer: ReturnType<typeof setTimeout> | null = null;
	let chatChannel = 'chat';
	let onRoomDeletedCallback: (() => void) | null = null;

	const isComposerLocked = $derived(!isOnline || status !== 'online');

	function setStatus(s: ConnectionStatus, text: string) {
		status = s;
		statusText = text;
	}

	function showBanner(
		kind: 'error' | 'warn' | 'info',
		message: string,
		options?: {
			autoHideMs?: number;
			canReconnect?: boolean;
			actionLabel?: string;
			onAction?: () => void;
		}
	) {
		if (bannerTimer) {
			clearTimeout(bannerTimer);
			bannerTimer = null;
		}

		banner = {
			kind,
			message,
			autoHideMs: options?.autoHideMs,
			canReconnect: options?.canReconnect,
			actionLabel: options?.actionLabel,
			onAction: options?.onAction
		};

		if (options?.autoHideMs && options.autoHideMs > 0) {
			bannerTimer = setTimeout(() => {
				dismissBanner();
			}, options.autoHideMs);
		}
	}

	function dismissBanner() {
		if (bannerTimer) {
			clearTimeout(bannerTimer);
			bannerTimer = null;
		}
		banner = null;
	}

	function pickChatChannel(channels: string[]): string {
		if (channels.includes('chat')) return 'chat';
		if (channels.includes('default')) return 'default';
		return channels.find((c) => c !== 'presence') || 'chat';
	}

	function attemptJoin() {
		pendingJoin = true;
		wsClient?.send({
			type: 'join_room',
			room: roomName,
			passcode: passcode || undefined
		});
	}

	function extractText(payload: unknown): string {
		if (payload == null) return '';
		if (typeof payload === 'string') return payload;
		if (
			typeof payload === 'object' &&
			'text' in payload &&
			typeof (payload as { text: unknown }).text === 'string'
		) {
			return (payload as { text: string }).text;
		}
		try {
			return JSON.stringify(payload);
		} catch {
			return String(payload);
		}
	}

	function handlePresence(payload: unknown) {
		if (!payload || typeof payload !== 'object') return;
		const pres = payload as PresencePayload;

		if (pres.event === 'join') {
			memberCount = Math.max(1, memberCount + 1);
			messages.push({
				id: `sys-${Date.now()}-${Math.random()}`,
				kind: 'system',
				text: `${pres.who} joined`,
				ts: Math.floor(Date.now() / 1000)
			});
			return;
		}

		if (pres.event === 'leave') {
			memberCount = Math.max(1, memberCount - 1);
			messages.push({
				id: `sys-${Date.now()}-${Math.random()}`,
				kind: 'system',
				text: `${pres.who} left`,
				ts: Math.floor(Date.now() / 1000)
			});
			return;
		}

		if (pres.event === 'room_deleted') {
			deletingRoom = false;
			isDeleting = false;
			messages.push({
				id: `sys-${Date.now()}-${Math.random()}`,
				kind: 'system',
				text: 'This room was deleted.',
				ts: Math.floor(Date.now() / 1000)
			});
			showBanner('warn', 'Room deleted. Returning to lobby…');
			setTimeout(() => {
				leaveRoom();
				onRoomDeletedCallback?.();
			}, 1200);
		}
	}

	function handleMessage(msg: InboundMessage) {
		switch (msg.type) {
			case 'welcome':
				selfLabel = msg.label || '';
				attemptJoin();
				break;

			case 'room_created':
				creatingRoom = false;
				attemptJoin();
				break;

			case 'room_joined':
				pendingJoin = false;
				creatingRoom = false;
				isOnline = true;
				memberCount = msg.members || 1;
				chatChannel = pickChatChannel(msg.channels || []);
				setStatus('online', 'Online');
				dismissBanner();
				wsClient?.startHeartbeat(25000, 10000);
				break;

			case 'room_left':
				isOnline = false;
				setStatus('connecting', 'Left room');
				break;

			case 'message':
				if (msg.channel === 'presence') {
					handlePresence(msg.payload);
					return;
				}

				// Skip echo if sent by self (already rendered optimistically)
				if (msg.from === selfLabel) return;

				messages.push({
					id: `msg-${msg.seq}-${Date.now()}`,
					kind: 'chat',
					from: msg.from,
					text: extractText(msg.payload),
					ts: msg.ts,
					own: false
				});
				break;

			case 'error': {
				const code = msg.code || 'ERROR';
				const text = msg.message || 'Unknown error';

				if (code === 'ROOM_NOT_FOUND') {
					if (deletingRoom) {
						deletingRoom = false;
						isDeleting = false;
						showBanner('warn', 'Room was already deleted. Returning to lobby…');
						setTimeout(() => {
							leaveRoom();
							onRoomDeletedCallback?.();
						}, 1200);
						return;
					}

					// Auto-create room on initial join if not found
					if (pendingJoin && !creatingRoom) {
						pendingJoin = false;
						creatingRoom = true;
						wsClient?.send({
							type: 'create_room',
							room: roomName,
							kind: roomKind
						});
						return;
					}
				}

				if (code === 'ROOM_ALREADY_EXISTS') {
					if (creatingRoom) {
						creatingRoom = false;
						attemptJoin();
						return;
					}
				}

				if (code === 'NOT_ROOM_OWNER') {
					deletingRoom = false;
					isDeleting = false;
					showBanner('error', text || 'Only the room creator or an admin can delete this room.');
					return;
				}

				if (code === 'RATE_LIMITED') {
					const wait = msg.retry_after_ms || 250;
					rateLimitedUntil = Date.now() + wait;
					showBanner('warn', `Slow down — try again in ${wait} ms.`, { autoHideMs: 1500 });
					return;
				}

				pendingJoin = false;
				creatingRoom = false;
				setStatus('error', 'Error');
				showBanner('error', `${code}: ${text}`, { canReconnect: true });
				break;
			}

			case 'pong':
				break;

			default:
				break;
		}
	}

	function init(room: string, roomPasscode = '', kind: RoomKind = 'chat', onDeleted?: () => void) {
		disconnect();
		roomName = room.trim();
		passcode = roomPasscode.trim();
		roomKind = kind;
		messages = [];
		memberCount = 0;
		isOnline = false;
		onRoomDeletedCallback = onDeleted || null;

		if (!roomName) {
			setStatus('error', 'No room');
			showBanner('error', 'No room specified. Pick one from the lobby.');
			return;
		}

		if (!configStore.hasKey) {
			setStatus('error', 'No API key');
			showBanner('error', 'Missing API key. Configure your API key to connect.');
			return;
		}

		connect();
	}

	function connect() {
		setStatus('connecting', 'Connecting…');
		dismissBanner();

		wsClient = new WSClient({
			apiKey: configStore.apiKey,
			wsOverride: configStore.wsOverride,
			onOpen: () => {
				setStatus('connecting', 'Authenticating…');
			},
			onMessage: handleMessage,
			onClose: (ev, isClosedByUs) => {
				isOnline = false;
				if (isClosedByUs) return;

				if (ev.code === 1008) {
					setStatus('error', 'Disconnected');
					showBanner('error', `Connection closed by server: ${ev.reason || 'policy violation'}`, {
						canReconnect: true
					});
				} else if (ev.code === 1001) {
					setStatus('error', 'Server away');
					showBanner('warn', 'Server is shutting down.', { canReconnect: true });
				} else {
					setStatus('error', 'Disconnected');
					showBanner('error', 'Connection lost.', { canReconnect: true });
				}
			},
			onError: () => {
				setStatus('error', 'Failed');
			},
			onStaleConnection: () => {
				showBanner('warn', 'Connection appears stale. Reconnecting is recommended.', {
					canReconnect: true
				});
			}
		});

		wsClient.connect();
	}

	function sendMessage(text: string): boolean {
		const trimmed = text.trim();
		if (!trimmed || !isOnline || !wsClient) return false;
		if (Date.now() < rateLimitedUntil) return false;

		const ok = wsClient.send({
			type: 'publish',
			room: roomName,
			channel: chatChannel,
			payload: { text: trimmed }
		});

		if (ok) {
			messages.push({
				id: `own-${Date.now()}-${Math.random()}`,
				kind: 'chat',
				from: selfLabel,
				text: trimmed,
				ts: Math.floor(Date.now() / 1000),
				own: true
			});
		}
		return ok;
	}

	function deleteCurrentRoom(): boolean {
		if (!isOnline || !wsClient) return false;
		deletingRoom = true;
		isDeleting = true;

		const sent = wsClient.send({
			type: 'delete_room',
			room: roomName
		});

		if (!sent) {
			deletingRoom = false;
			isDeleting = false;
			showBanner('error', 'Not connected.');
		}
		return sent;
	}

	function leaveRoom() {
		if (isOnline && wsClient) {
			wsClient.send({
				type: 'leave_room',
				room: roomName
			});
		}
		disconnect();
	}

	function disconnect() {
		wsClient?.disconnect();
		wsClient = null;
		isOnline = false;
		setStatus('disconnected', 'Disconnected');
	}

	return {
		get roomName() {
			return roomName;
		},
		get status() {
			return status;
		},
		get statusText() {
			return statusText;
		},
		get isOnline() {
			return isOnline;
		},
		get selfLabel() {
			return selfLabel;
		},
		get memberCount() {
			return memberCount;
		},
		get messages() {
			return messages;
		},
		get banner() {
			return banner;
		},
		get isDeleting() {
			return isDeleting;
		},
		get isComposerLocked() {
			return isComposerLocked;
		},
		init,
		connect,
		sendMessage,
		deleteCurrentRoom,
		leaveRoom,
		disconnect,
		dismissBanner
	};
}

export const chatStore = createChatStore();
