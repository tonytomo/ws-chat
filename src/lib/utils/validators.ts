import type { RoomKind } from '#lib/types/protocol';

export const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates room name according to protocol rules (1-64 chars, a-z A-Z 0-9 _ -).
 */
export function isValidRoomName(name: string): boolean {
	return ROOM_NAME_REGEX.test(name.trim());
}

export interface KindPresetInfo {
	label: string;
	description: string;
	defaultMaxMembers: number;
	defaultEphemeral: boolean;
}

export const KIND_PRESETS: Record<RoomKind, KindPresetInfo> = {
	chat: {
		label: 'Chat',
		description: 'Long-lived, 500 members',
		defaultMaxMembers: 500,
		defaultEphemeral: false
	},
	game: {
		label: 'Game',
		description: 'Ephemeral, 16 members',
		defaultMaxMembers: 16,
		defaultEphemeral: true
	},
	custom: {
		label: 'Custom',
		description: 'Ephemeral, 64 members',
		defaultMaxMembers: 64,
		defaultEphemeral: true
	}
};

/**
 * Resolves the default ephemeral setting for a room kind.
 * chat: false, game: true, custom: true
 */
export function getDefaultEphemeralForKind(kind: RoomKind): boolean {
	return KIND_PRESETS[kind]?.defaultEphemeral ?? true;
}

