<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	import { configStore } from '#lib/stores/configStore.svelte';
	import { lobbyStore, type CreateRoomOptions } from '#lib/stores/lobbyStore.svelte';
	import type { Room } from '#lib/types/protocol';
	import Banner from '#lib/components/ui/Banner.svelte';
	import RoomCard from '#lib/components/lobby/RoomCard.svelte';
	import CreateRoomModal from '#lib/components/lobby/CreateRoomModal.svelte';
	import KeyConfigModal from '#lib/components/lobby/KeyConfigModal.svelte';

	let isCreateModalOpen = $state(false);
	let isKeyModalOpen = $state(false);
	let quickRoomName = $state('');

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
			// Error handled inside modal or lobbyStore.createError
		}
	}

	async function handleQuickCreate(e: SubmitEvent) {
		e.preventDefault();
		let val = quickRoomName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-_]/g, '-');
		if (val.startsWith('#')) {
			val = val.slice(1);
		}
		if (!val) return;

		await handleCreateRoom({
			name: val,
			kind: 'chat',
			ephemeral: false
		});
		quickRoomName = '';
	}
</script>

<svelte:head>
	<title>Ping · Lobby</title>
</svelte:head>

<!-- Ambient high-tech background glows -->
<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
	<div
		class="absolute -top-40 left-1/2 h-125 w-162.5 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]"
	></div>
	<div
		class="absolute right-1/4 bottom-10 h-112.5 w-112.5 rounded-full bg-emerald-600/5 blur-[140px]"
	></div>
</div>

<div class="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 md:py-20">
	<!-- Header & Brand / Active User Profile Bar -->
	<header class="mb-8 flex flex-col items-center text-center">
		<div
			class="inline-flex items-center gap-3 rounded-full border border-slate-800 bg-surface/80 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur-md transition-all hover:border-slate-700"
		>
			<div class="flex items-center gap-2 text-sm">
				<span class="font-normal text-slate-400">Signed in as</span>
				<span class="font-bold text-slate-100" id="current-username">
					{lobbyStore.selfLabel || 'Guest'}
				</span>
			</div>

			<button
				type="button"
				title="Configure API key / endpoint"
				aria-label="Configure API key"
				onclick={() => (isKeyModalOpen = true)}
				class="ml-1 cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-surface-elevated hover:text-emerald-400"
			>
				<span class="material-symbols-outlined text-base leading-none">settings</span>
			</button>
		</div>
	</header>

	<!-- Banner Alerts -->
	{#if lobbyStore.banner}
		<div class="mb-6">
			<Banner banner={lobbyStore.banner} onDismiss={lobbyStore.dismissBanner} />
		</div>
	{/if}

	<!-- Create Room Card / High-Tech Glass Container -->
	<div
		class="mb-8 rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-xl shadow-black/50 backdrop-blur-xl transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30"
	>
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="material-symbols-outlined text-xl text-emerald-400">add_circle</span>
				<h2 class="text-sm font-semibold tracking-wide text-slate-200 uppercase">
					Create a New Room
				</h2>
			</div>

			<button
				type="button"
				title="Advanced room options"
				onclick={() => (isCreateModalOpen = true)}
				class="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-emerald-400"
			>
				<span class="material-symbols-outlined text-sm leading-none">tune</span>
				<span class="hidden sm:inline">Advanced</span>
			</button>
		</div>

		<form
			class="flex flex-col gap-3 sm:flex-row"
			id="create-room-form"
			onsubmit={handleQuickCreate}
		>
			<div class="relative flex-1">
				<span class="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-500">
					#
				</span>
				<input
					class="w-full rounded-xl border border-slate-800 bg-surface-elevated py-3 pr-4 pl-8 text-sm font-medium text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80 focus:bg-surface-elevated/90 disabled:opacity-50"
					id="room-input"
					placeholder="room-name (e.g. design-critique)"
					required
					type="text"
					bind:value={quickRoomName}
					disabled={lobbyStore.isCreating}
				/>
			</div>

			<button
				class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				type="submit"
				disabled={lobbyStore.isCreating || !quickRoomName.trim()}
			>
				<span>{lobbyStore.isCreating ? 'Creating…' : 'Create Room'}</span>
				<span class="material-symbols-outlined text-base leading-none">arrow_forward</span>
			</button>
		</form>

		{#if lobbyStore.createError}
			<p class="mt-3 text-xs text-red-400">{lobbyStore.createError}</p>
		{/if}
	</div>

	<!-- Active Rooms Section -->
	<section class="flex flex-col gap-3.5">
		<div class="mb-1 flex items-center justify-between px-1">
			<div class="flex items-center gap-2.5">
				<h2 class="text-lg font-bold tracking-tight text-slate-100">Active Rooms</h2>
				<span
					class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 shadow-sm"
					id="room-count-badge"
				>
					{lobbyStore.filteredRooms.length}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<div class="relative">
					<input
						type="search"
						placeholder="Filter rooms…"
						aria-label="Filter rooms"
						value={lobbyStore.filterQuery}
						oninput={(e) => lobbyStore.setFilter(e.currentTarget.value)}
						class="w-32 rounded-full border border-slate-800 bg-surface-elevated py-1.5 pr-3 pl-8 text-xs text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80 sm:w-44"
					/>
					<span
						class="material-symbols-outlined absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate-500"
					>
						search
					</span>
				</div>

				<button
					type="button"
					title="Refresh rooms"
					aria-label="Refresh rooms"
					onclick={lobbyStore.refreshRooms}
					class="cursor-pointer rounded-full border border-slate-800 bg-surface-elevated p-1.5 text-slate-400 transition-all hover:border-slate-700 hover:text-emerald-400"
				>
					<span class="material-symbols-outlined text-sm leading-none">refresh</span>
				</button>
			</div>
		</div>

		<div class="flex flex-col gap-3" id="rooms-list">
			{#if lobbyStore.filteredRooms.length === 0}
				<div
					class="rounded-2xl border border-slate-800/80 bg-surface/40 px-4 py-12 text-center text-sm text-slate-400"
				>
					<span class="material-symbols-outlined mb-2 block text-3xl text-slate-600">
						meeting_room
					</span>
					{lobbyStore.roomCount === 0
						? 'No rooms yet. Be the first to create one.'
						: 'No rooms match your filter.'}
				</div>
			{:else}
				{#each lobbyStore.filteredRooms as room (room.name)}
					<RoomCard {room} onSelect={handleRoomSelect} onDelete={handleRoomDelete} />
				{/each}
			{/if}
		</div>

		{#if lobbyStore.lastUpdated}
			<div class="px-1 text-center text-[11px] text-slate-600">
				{lobbyStore.lastUpdated}
			</div>
		{/if}
	</section>
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
