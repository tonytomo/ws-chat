<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';

	import { configStore } from '#lib/stores/configStore.svelte';
	import { chatStore } from '#lib/stores/chatStore.svelte';
	import type { RoomKind } from '#lib/types/protocol';
	import Banner from '#lib/components/ui/Banner.svelte';
	import ChatFeed from '#lib/components/chat/ChatFeed.svelte';
	import ChatComposer from '#lib/components/chat/ChatComposer.svelte';

	onMount(() => {
		configStore.init();

		let pending: { room?: string; passcode?: string; kind?: RoomKind } | null = null;
		if (typeof window !== 'undefined') {
			try {
				pending = JSON.parse(sessionStorage.getItem('ws.pendingRoom') || 'null');
				sessionStorage.removeItem('ws.pendingRoom');
			} catch {
				// Ignore parse error
			}
		}

		const roomParam = (page.url.searchParams.get('room') || pending?.room || '').trim();
		const passcodeParam = page.url.searchParams.get('passcode') || pending?.passcode || '';
		const kindParam = (
			page.url.searchParams.get('kind') ||
			pending?.kind ||
			'chat'
		).trim() as RoomKind;

		chatStore.init(roomParam, passcodeParam, kindParam, () => {
			goto(resolve('/'));
		});
	});

	onDestroy(() => {
		chatStore.leaveRoom();
	});

	function handleDeleteRoom() {
		if (!chatStore.isOnline) return;

		const confirmed = window.confirm(
			`Delete room "${chatStore.roomName}"?\n\nAll members will be removed and the room cannot be recovered.`
		);
		if (!confirmed) return;

		chatStore.deleteCurrentRoom();
	}
</script>

<svelte:head>
	<title>#{chatStore.roomName || 'chat'} · Room</title>
</svelte:head>

<div
	class="flex h-dvh flex-col bg-[#0b0f19] font-sans text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300"
>
	<!-- Minimal Centered Top Bar with Glassmorphism -->
	<header
		class="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-[#0b0f19]/80 shadow-lg shadow-black/20 backdrop-blur-xl"
	>
		<div class="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
			<a
				href={resolve('/')}
				title="Back to Lobby"
				aria-label="Back to Lobby"
				class="group inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-sm font-medium text-slate-400 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-slate-800 hover:text-emerald-400"
			>
				<span
					class="material-symbols-outlined text-lg text-slate-400 transition-transform group-hover:-translate-x-0.5 group-hover:text-emerald-400"
				>
					arrow_back
				</span>
				<span>Back to Lobby</span>
			</a>

			<div class="flex flex-col items-center">
				<div class="flex items-center gap-1.5">
					<span class="text-lg font-extrabold text-emerald-400">#</span>
					<h1
						class="max-w-[170px] truncate text-lg font-bold tracking-tight text-slate-100 sm:max-w-xs sm:text-xl"
					>
						{chatStore.roomName || 'chat'}
					</h1>
				</div>

				<div class="flex items-center gap-1.5 text-xs font-medium text-slate-400">
					{#if chatStore.isOnline}
						<span class="relative flex h-2 w-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
							></span>
							<span
								class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"
							></span>
						</span>
						<span>{chatStore.memberCount} online</span>
					{:else}
						<span
							class="h-2 w-2 rounded-full {chatStore.status === 'connecting'
								? 'bg-amber-400'
								: 'bg-red-400'}"
						></span>
						<span>{chatStore.statusText}</span>
					{/if}
				</div>
			</div>

			<div class="flex w-28 items-center justify-end gap-2">
				{#if chatStore.isOnline}
					<span
						class="hidden items-center gap-1 rounded-full border border-slate-800 bg-slate-800/60 px-2.5 py-1 text-xs font-semibold text-slate-400 sm:inline-flex"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Live
					</span>

					<button
						type="button"
						title="Delete room"
						aria-label="Delete room"
						disabled={chatStore.isDeleting}
						onclick={handleDeleteRoom}
						class="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
					>
						<span class="material-symbols-outlined text-base leading-none">delete</span>
					</button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Banner Alerts -->
	{#if chatStore.banner}
		<div class="mx-auto w-full max-w-4xl px-4 pt-3 sm:px-6">
			<Banner
				banner={chatStore.banner}
				onDismiss={chatStore.dismissBanner}
				onReconnect={chatStore.connect}
			/>
		</div>
	{/if}

	<!-- Clean Message Feed -->
	<ChatFeed messages={chatStore.messages} />

	<!-- High-Tech Floating Pill Message Input Bottom Bar -->
	<ChatComposer
		isLocked={chatStore.isComposerLocked}
		roomName={chatStore.roomName}
		onSend={chatStore.sendMessage}
	/>
</div>
