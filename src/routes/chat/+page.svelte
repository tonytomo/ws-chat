<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { configStore } from '#lib/stores/configStore.svelte';
	import { chatStore } from '#lib/stores/chatStore.svelte';
	import type { RoomKind } from '#lib/types/protocol';
	import StatusDot from '#lib/components/ui/StatusDot.svelte';
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
	<title>#{chatStore.roomName || 'Chat'} - Game Chat</title>
</svelte:head>

<div class="mx-auto flex h-dvh max-w-4xl flex-col border-x border-border bg-surface shadow-xs">
	<!-- Top Bar -->
	<header
		class="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3"
	>
		<div class="flex min-w-0 items-center gap-3">
			<a
				href={resolve('/')}
				title="Back to Lobby"
				aria-label="Back to Lobby"
				class="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-muted hover:bg-surface hover:text-text"
			>
				← Lobby
			</a>

			<div class="flex min-w-0 items-baseline gap-1.5">
				<span class="text-sm font-semibold text-muted select-none">#</span>
				<h1 class="truncate text-base font-bold tracking-tight text-text">
					{chatStore.roomName || 'lobby'}
				</h1>
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<span
				class="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted"
			>
				{chatStore.memberCount} online
			</span>

			{#if chatStore.isOnline}
				<button
					type="button"
					title="Delete this room"
					aria-label="Delete this room"
					disabled={chatStore.isDeleting}
					onclick={handleDeleteRoom}
					class="rounded-lg p-1.5 text-xs text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
				>
					🗑
				</button>
			{/if}

			<StatusDot status={chatStore.status} text={chatStore.statusText} />
		</div>
	</header>

	<!-- Banner Alerts -->
	<Banner
		banner={chatStore.banner}
		onDismiss={chatStore.dismissBanner}
		onReconnect={chatStore.connect}
	/>

	<!-- Chat Messages Feed -->
	<ChatFeed messages={chatStore.messages} />

	<!-- Message Composer -->
	<ChatComposer isLocked={chatStore.isComposerLocked} onSend={chatStore.sendMessage} />
</div>
