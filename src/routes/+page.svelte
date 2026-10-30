<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { configStore } from '#lib/stores/configStore.svelte';
	import { lobbyStore, type CreateRoomOptions } from '#lib/stores/lobbyStore.svelte';
	import type { Room } from '#lib/types/protocol';
	import Button from '#lib/components/ui/Button.svelte';
	import StatusDot from '#lib/components/ui/StatusDot.svelte';
	import Banner from '#lib/components/ui/Banner.svelte';
	import RoomCard from '#lib/components/lobby/RoomCard.svelte';
	import CreateRoomModal from '#lib/components/lobby/CreateRoomModal.svelte';
	import KeyConfigModal from '#lib/components/lobby/KeyConfigModal.svelte';

	let isCreateModalOpen = $state(false);
	let isKeyModalOpen = $state(false);

	onMount(() => {
		configStore.init();
		lobbyStore.connect();
	});

	onDestroy(() => {
		lobbyStore.disconnect();
	});

	function handleRoomSelect(room: Room) {
		let passcode = '';
		if (room.protected) {
			const input = window.prompt(`Passcode for "${room.name}":`, '');
			if (input === null) return;
			passcode = input;
		}

		if (typeof window !== 'undefined') {
			sessionStorage.setItem(
				'ws.pendingRoom',
				JSON.stringify({
					room: room.name,
					passcode: passcode || '',
					kind: room.kind || 'chat'
				})
			);
		}

		const q = new SvelteURLSearchParams();
		q.set('room', room.name);
		if (passcode) q.set('passcode', passcode);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/chat')}?${q.toString()}`);
	}

	function handleRoomDelete(room: Room) {
		const confirmed = window.confirm(
			`Delete room "${room.name}"?\n\nAll members will be removed and the room cannot be recovered.`
		);
		if (!confirmed) return;

		lobbyStore.deleteRoom(room.name);
	}

	async function handleCreateRoom(data: CreateRoomOptions) {
		try {
			const createdRoom = await lobbyStore.createRoom(data);
			isCreateModalOpen = false;

			if (typeof window !== 'undefined') {
				sessionStorage.setItem(
					'ws.pendingRoom',
					JSON.stringify({
						room: createdRoom,
						passcode: data.passcode || '',
						kind: data.kind
					})
				);
			}

			const q = new SvelteURLSearchParams();
			q.set('room', createdRoom);
			if (data.passcode) q.set('passcode', data.passcode);
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(`${resolve('/chat')}?${q.toString()}`);
		} catch {
			// Error handled inside modal via lobbyStore.createError
		}
	}
</script>

<svelte:head>
	<title>Lobby - Game Chat</title>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-4xl flex-col border-x border-border bg-surface shadow-xs">
	<!-- Top Bar -->
	<header
		class="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3.5"
	>
		<div class="flex min-w-0 items-baseline gap-2.5">
			<h1 class="text-lg font-bold tracking-tight text-text">Lobby</h1>
			{#if lobbyStore.selfLabel}
				<span
					class="max-w-[140px] truncate rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted"
				>
					{lobbyStore.selfLabel}
				</span>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<span
				class="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted"
			>
				{lobbyStore.roomCount} room{lobbyStore.roomCount === 1 ? '' : 's'}
			</span>

			<StatusDot status={lobbyStore.status} text={lobbyStore.statusText} />

			<button
				type="button"
				title="Configure API key / endpoint"
				aria-label="Configure API key"
				onclick={() => (isKeyModalOpen = true)}
				class="rounded-lg p-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
			>
				⚙️
			</button>
		</div>
	</header>

	<!-- Toolbar -->
	<div class="flex shrink-0 items-center gap-2.5 border-b border-border bg-surface px-5 py-3">
		<input
			type="search"
			placeholder="Filter rooms…"
			aria-label="Filter rooms"
			value={lobbyStore.filterQuery}
			oninput={(e) => lobbyStore.setFilter(e.currentTarget.value)}
			class="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-text transition-all outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
		/>

		<Button
			variant="ghost"
			title="Refresh rooms"
			ariaLabel="Refresh rooms"
			onclick={lobbyStore.refreshRooms}
		>
			↻
		</Button>

		<Button
			variant="primary"
			disabled={!configStore.hasKey}
			onclick={() => (isCreateModalOpen = true)}
		>
			+ Create room
		</Button>
	</div>

	<!-- Banner -->
	<Banner banner={lobbyStore.banner} onDismiss={lobbyStore.dismissBanner} />

	<!-- Rooms Grid -->
	<main class="flex-1 overflow-y-auto p-5" aria-live="polite" aria-label="Rooms">
		{#if lobbyStore.filteredRooms.length === 0}
			<div class="py-16 text-center text-sm text-muted">
				{lobbyStore.roomCount === 0
					? 'No rooms yet. Be the first to create one.'
					: 'No rooms match your filter.'}
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
				{#each lobbyStore.filteredRooms as room (room.name)}
					<RoomCard {room} onSelect={handleRoomSelect} onDelete={handleRoomDelete} />
				{/each}
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer
		class="shrink-0 border-t border-border px-5 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-xs text-muted"
	>
		<span>{lobbyStore.lastUpdated}</span>
	</footer>
</div>

<!-- Modals -->
<CreateRoomModal
	isOpen={isCreateModalOpen}
	isCreating={lobbyStore.isCreating}
	errorMessage={lobbyStore.createError}
	onClose={() => {
		isCreateModalOpen = false;
		lobbyStore.clearCreateError();
	}}
	onSubmit={handleCreateRoom}
/>

<KeyConfigModal
	isOpen={isKeyModalOpen}
	onClose={() => (isKeyModalOpen = false)}
	onSaved={() => lobbyStore.connect()}
/>
