<script lang="ts">
	import type { Room } from '#lib/types/protocol';

	interface Props {
		room: Room;
		onSelect: (room: Room) => void;
		onDelete: (room: Room) => void;
	}

	const { room, onSelect, onDelete }: Props = $props();

	function getRoomIcon(name: string, kind?: string): string {
		const lower = (name + ' ' + (kind || '')).toLowerCase();
		if (
			lower.includes('design') ||
			lower.includes('art') ||
			lower.includes('draw') ||
			lower.includes('ui')
		) {
			return 'palette';
		}
		if (
			lower.includes('coffee') ||
			lower.includes('random') ||
			lower.includes('lounge') ||
			lower.includes('chill')
		) {
			return 'coffee';
		}
		if (
			lower.includes('game') ||
			lower.includes('play') ||
			lower.includes('arena') ||
			lower.includes('match')
		) {
			return 'sports_esports';
		}
		if (
			lower.includes('dev') ||
			lower.includes('code') ||
			lower.includes('tech') ||
			lower.includes('bug')
		) {
			return 'code';
		}
		if (lower.includes('music') || lower.includes('song') || lower.includes('sound')) {
			return 'music_note';
		}
		if (lower.includes('news') || lower.includes('announcement')) {
			return 'campaign';
		}
		if (lower.includes('debate') || lower.includes('talk') || lower.includes('discuss')) {
			return 'forum';
		}
		return 'tag';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(room);
		}
	}

	function handleDeleteClick(e: MouseEvent) {
		e.stopPropagation();
		onDelete(room);
	}
</script>

<div
	role="button"
	tabindex="0"
	onclick={() => onSelect(room)}
	onkeydown={handleKeydown}
	class="group flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800/90 bg-[#111827]/70 p-4 shadow-sm backdrop-blur-md transition-all hover:border-slate-700 hover:bg-[#161f30]/80"
>
	<div class="flex min-w-0 items-center gap-3.5">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800/80 bg-[#161f30] text-emerald-400 shadow-inner transition-all group-hover:bg-emerald-500 group-hover:text-slate-950"
		>
			<span class="material-symbols-outlined text-xl">
				{getRoomIcon(room.name, room.kind)}
			</span>
		</div>

		<div class="min-w-0">
			<div class="flex items-center gap-1.5">
				<h3 class="truncate text-sm font-semibold text-slate-100">
					#{room.name}
				</h3>
				{#if room.protected}
					<span class="material-symbols-outlined text-sm text-amber-400" title="Passcode protected">
						lock
					</span>
				{/if}
			</div>

			<p class="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
				<span>{room.members} member{room.members === 1 ? '' : 's'} online</span>
				{#if room.kind && room.kind !== 'chat'}
					<span class="text-slate-600">·</span>
					<span class="text-slate-500 capitalize">{room.kind}</span>
				{/if}
			</p>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			title="Delete room"
			aria-label="Delete room {room.name}"
			onclick={handleDeleteClick}
			class="cursor-pointer rounded-xl p-2 text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 focus:opacity-100"
		>
			<span class="material-symbols-outlined text-base leading-none">delete</span>
		</button>

		<button
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				onSelect(room);
			}}
			class="shrink-0 cursor-pointer rounded-full border border-slate-700/60 bg-[#161f30] px-5 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-emerald-400/50 hover:bg-emerald-500 hover:text-slate-950 active:scale-[0.98]"
		>
			Join
		</button>
	</div>
</div>
