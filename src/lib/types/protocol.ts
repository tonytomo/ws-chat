export type RoomKind = 'chat' | 'game' | 'custom';

export interface ChannelConfig {
	name?: string;
	reliable?: boolean;
	max_rate?: number;
}

export interface Room {
	name: string;
	members: number;
	protected: boolean;
	kind: RoomKind;
	channels?: string[];
	channel_configs?: Record<string, ChannelConfig>;
	max_members: number;
	created_at: number;
	metadata?: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'online' | 'error' | 'disconnected';

export interface WelcomeMessage {
	type: 'welcome';
	client_id: string;
	label: string;
	server_version?: string;
}

export interface RoomCreatedMessage {
	type: 'room_created';
	room: string;
	channels: string[];
}

export interface RoomJoinedMessage {
	type: 'room_joined';
	room: string;
	channels: string[];
	members: number;
}

export interface RoomLeftMessage {
	type: 'room_left';
	room: string;
}

export interface RoomListMessage {
	type: 'room_list';
	rooms: Room[];
}

export interface PresencePayload {
	event: 'join' | 'leave' | 'room_deleted';
	who: string;
}

export interface BroadcastMessage {
	type: 'message';
	room: string;
	channel: string;
	from: string;
	seq: number;
	ts: number;
	payload: PresencePayload | { text?: string; [key: string]: unknown } | string;
}

export interface ErrorMessage {
	type: 'error';
	code: string;
	message: string;
	channel?: string;
	retry_after_ms?: number;
}

export interface PongMessage {
	type: 'pong';
}

export type InboundMessage =
	| WelcomeMessage
	| RoomCreatedMessage
	| RoomJoinedMessage
	| RoomLeftMessage
	| RoomListMessage
	| BroadcastMessage
	| ErrorMessage
	| PongMessage;

export interface CreateRoomPayload {
	type: 'create_room';
	room: string;
	kind?: RoomKind;
	passcode?: string;
	max_members?: number;
	ephemeral?: boolean;
	channels?: Record<string, ChannelConfig>;
	metadata?: Record<string, unknown>;
}

export interface JoinRoomPayload {
	type: 'join_room';
	room: string;
	passcode?: string;
	binary_channels?: Record<string, number>;
}

export interface LeaveRoomPayload {
	type: 'leave_room';
	room: string;
}

export interface DeleteRoomPayload {
	type: 'delete_room';
	room: string;
}

export interface ListRoomsPayload {
	type: 'list_rooms';
}

export interface PublishPayload {
	type: 'publish';
	room: string;
	channel: string;
	reliable?: boolean;
	payload: unknown;
	include_sender?: boolean;
}

export interface PingPayload {
	type: 'ping';
}

export type OutboundPayload =
	| CreateRoomPayload
	| JoinRoomPayload
	| LeaveRoomPayload
	| DeleteRoomPayload
	| ListRoomsPayload
	| PublishPayload
	| PingPayload;

export interface ChatFeedItem {
	id: string;
	kind: 'chat' | 'system';
	from?: string;
	text: string;
	ts: number;
	own?: boolean;
}

export interface BannerState {
	kind: 'error' | 'warn' | 'info';
	message: string;
	autoHideMs?: number;
	canReconnect?: boolean;
	actionLabel?: string;
	onAction?: () => void;
}

