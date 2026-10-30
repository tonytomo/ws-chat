import { SvelteDate } from 'svelte/reactivity';
import { WSClient } from '#lib/api/wsClient';
import { configStore } from '#lib/stores/configStore.svelte';
import type {
	BannerState,
	ConnectionStatus,
	CreateRoomPayload,
	InboundMessage,
	Room,
	RoomKind
} from '#lib/types/protocol';
import { isValidRoomName } from '#lib/utils/validators';

const POLL_INTERVAL_MS = 5000;
const RECONNECT_DELAY_MS = 3000;

export interface CreateRoomOptions {
	name: string;
	kind: RoomKind;
	passcode?: string;
	maxMembers?: number;
	ephemeral: boolean;
}

export function createLobbyStore() {
	let wsClient: WSClient | null = null;
	let status = $state<ConnectionStatus>('disconnected');
	let statusText = $state<string>('Disconnected');
	let selfLabel = $state<string>('');
	let rooms = $state<Room[]>([]);
	let filterQuery = $state<string>('');
	let lastUpdated = $state<string>('');
	let banner = $state<BannerState | null>(null);
	let isCreating = $state<boolean>(false);
	let createError = $state<string>('');

	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let bannerTimer: ReturnType<typeof setTimeout> | null = null;
	let sawWelcome = false;
	let pendingCreateResolver: ((roomName: string) => void) | null = null;

	const filteredRooms = $derived.by(() => {
		const q = filterQuery.trim().toLowerCase();
		const list = q ? rooms.filter((r) => r.name.toLowerCase().includes(q)) : [...rooms];
		return list.sort((a, b) => a.name.localeCompare(b.name));
	});

	const roomCount = $derived(rooms.length);

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

	function scheduleReconnect() {
		clearTimeout(reconnectTimer ?? undefined);
		reconnectTimer = setTimeout(() => {
			connect();
		}, RECONNECT_DELAY_MS);
	}

	function startPolling() {
		stopPolling();
		pollTimer = setInterval(() => {
			requestRooms();
		}, POLL_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	function requestRooms() {
		wsClient?.send({ type: 'list_rooms' });
	}

	function refreshRooms() {
		lastUpdated = 'Refreshing…';
		requestRooms();
	}

	function handleMessage(msg: InboundMessage) {
		switch (msg.type) {
			case 'welcome':
				sawWelcome = true;
				selfLabel = msg.label || '';
				setStatus('online', 'Online');
				dismissBanner();
				requestRooms();
				startPolling();
				break;

			case 'room_list':
				rooms = Array.isArray(msg.rooms) ? msg.rooms : [];
				lastUpdated = `Updated ${new SvelteDate().toLocaleTimeString()}`;
				break;

			case 'room_created':
				isCreating = false;
				createError = '';
				if (pendingCreateResolver) {
					pendingCreateResolver(msg.room);
					pendingCreateResolver = null;
				}
				break;

			case 'error': {
				const code = msg.code || 'ERROR';
				const text = msg.message || 'Unknown error';

				if (isCreating) {
					isCreating = false;
					createError = `${code}: ${text}`;
					return;
				}

				if (code === 'RATE_LIMITED') {
					const wait = msg.retry_after_ms || 250;
					showBanner('warn', `Slow down — retry in ${wait} ms.`, { autoHideMs: 1500 });
					return;
				}

				if (code === 'NOT_ROOM_OWNER') {
					showBanner('error', text || 'Only the room creator or an admin can delete this room.');
					return;
				}

				if (code === 'ROOM_NOT_FOUND') {
					showBanner('warn', 'That room no longer exists.', { autoHideMs: 2000 });
					requestRooms();
					return;
				}

				showBanner('error', `${code}: ${text}`);
				break;
			}

			case 'pong':
				break;

			default:
				break;
		}
	}

	function connect() {
		clearTimeout(reconnectTimer ?? undefined);
		stopPolling();
		sawWelcome = false;

		if (!configStore.hasKey) {
			setStatus('error', 'No key');
			showBanner('error', 'Missing API key. Configure your API key to connect.', {
				canReconnect: false
			});
			return;
		}

		setStatus('connecting', 'Connecting…');

		wsClient = new WSClient({
			apiKey: configStore.apiKey,
			wsOverride: configStore.wsOverride,
			onOpen: () => {
				setStatus('connecting', 'Authenticating…');
			},
			onMessage: handleMessage,
			onClose: (ev, isClosedByUs) => {
				stopPolling();
				if (isClosedByUs) return;

				if (!sawWelcome) {
					showBanner('error', 'Connection rejected. Your stored key may be invalid or expired.', {
						actionLabel: 'Reset key',
						onAction: () => {
							configStore.clear();
							dismissBanner();
							connect();
						}
					});
				}

				if (ev.code === 1008) {
					setStatus('error', 'Rejected');
					showBanner(
						'error',
						`Server rejected connection: ${ev.reason || 'policy violation'}. Check your API key.`
					);
				} else if (ev.code === 1001) {
					setStatus('error', 'Server away');
					showBanner('warn', 'Server is shutting down.');
				} else {
					setStatus('error', 'Disconnected');
					scheduleReconnect();
				}
			},
			onError: () => {
				setStatus('error', 'Failed');
			}
		});

		wsClient.connect();
	}

	function disconnect() {
		stopPolling();
		clearTimeout(reconnectTimer ?? undefined);
		wsClient?.disconnect();
		wsClient = null;
		setStatus('disconnected', 'Disconnected');
	}

	function createRoom(options: CreateRoomOptions): Promise<string> {
		return new Promise((resolve, reject) => {
			const name = options.name.trim();
			if (!isValidRoomName(name)) {
				createError = 'Invalid room name. Use 1–64 characters from a–z A–Z 0–9 _ -';
				reject(new Error(createError));
				return;
			}

			if (!wsClient || !wsClient.isConnected) {
				createError = 'Not connected to server.';
				reject(new Error(createError));
				return;
			}

			const payload: CreateRoomPayload = {
				type: 'create_room',
				room: name,
				kind: options.kind,
				ephemeral: options.ephemeral
			};

			if (options.passcode?.trim()) {
				payload.passcode = options.passcode.trim();
			}

			if (options.maxMembers && options.maxMembers > 0) {
				payload.max_members = options.maxMembers;
			}

			isCreating = true;
			createError = '';
			pendingCreateResolver = resolve;

			const sent = wsClient.send(payload);
			if (!sent) {
				isCreating = false;
				createError = 'Failed to send create request.';
				pendingCreateResolver = null;
				reject(new Error(createError));
			}
		});
	}

	function deleteRoom(roomName: string): boolean {
		if (!wsClient || !wsClient.isConnected) {
			showBanner('error', 'Not connected to server.');
			return false;
		}

		const sent = wsClient.send({
			type: 'delete_room',
			room: roomName
		});

		if (sent) {
			// Hub emits room_deleted to members; refresh rooms list after a beat
			setTimeout(requestRooms, 400);
		}
		return sent;
	}

	function setFilter(query: string) {
		filterQuery = query;
	}

	return {
		get status() {
			return status;
		},
		get statusText() {
			return statusText;
		},
		get selfLabel() {
			return selfLabel;
		},
		get rooms() {
			return rooms;
		},
		get filteredRooms() {
			return filteredRooms;
		},
		get roomCount() {
			return roomCount;
		},
		get filterQuery() {
			return filterQuery;
		},
		get lastUpdated() {
			return lastUpdated;
		},
		get banner() {
			return banner;
		},
		get isCreating() {
			return isCreating;
		},
		get createError() {
			return createError;
		},
		connect,
		disconnect,
		refreshRooms,
		createRoom,
		deleteRoom,
		setFilter,
		dismissBanner,
		clearCreateError: () => {
			createError = '';
		}
	};
}

export const lobbyStore = createLobbyStore();
