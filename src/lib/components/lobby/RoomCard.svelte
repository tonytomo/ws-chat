<script lang="ts">
	import type { Room } from '#lib/types/protocol';
	import { formatRelativeTime } from '#lib/utils/formatters';
	import Badge from '#lib/components/ui/Badge.svelte';

	interface Props {
		room: Room;
		onSelect: (room: Room) => void;
		onDelete: (room: Room) => void;
	}

	const { room, onSelect, onDelete }: Props = $props();

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
	class="group relative flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border border-border bg-surface-2 p-4 text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:bg-surface hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
>
	<div class="flex min-w-0 items-center justify-between gap-2">
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<span class="truncate text-base font-bold text-text">
				{room.name}
			</span>
			{#if room.protected}
				<Badge variant="lock" title="Password protected">🔒</Badge>
			{/if}
		</div>

		<button
			type="button"
			title="Delete room"
			aria-label="Delete room {room.name}"
			onclick={handleDeleteClick}
			class="shrink-0 rounded-lg p-1.5 text-xs text-muted opacity-60 transition-all hover:bg-danger/10 hover:text-danger hover:opacity-100"
		>
			🗑
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-xs">
		<Badge variant="kind">
			{room.kind || 'custom'}
		</Badge>
		<span class="text-muted">
			{room.members}/{room.max_members} members
		</span>
	</div>

	<div class="text-[11px] text-muted">
		Created {formatRelativeTime(room.created_at)}
	</div>
</div>
