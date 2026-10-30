<script lang="ts">
	import type { ChatFeedItem } from '#lib/types/protocol';
	import ChatMessage from './ChatMessage.svelte';
	import SystemMessage from './SystemMessage.svelte';

	interface Props {
		messages: ChatFeedItem[];
	}

	const { messages }: Props = $props();

	let feedEl: HTMLElement | null = $state(null);
	let isNearBottom = true;

	function handleScroll() {
		if (!feedEl) return;
		const distance = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
		isNearBottom = distance < 120;
	}

	$effect(() => {
		if (messages.length >= 0 && feedEl && isNearBottom) {
			requestAnimationFrame(() => {
				if (feedEl) {
					feedEl.scrollTop = feedEl.scrollHeight;
				}
			});
		}
	});
</script>

<main
	bind:this={feedEl}
	onscroll={handleScroll}
	aria-live="polite"
	aria-label="Messages"
	class="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4"
>
	{#if messages.length === 0}
		<div class="m-auto text-center text-sm text-muted">No messages yet. Say hello 👋</div>
	{:else}
		{#each messages as item (item.id)}
			{#if item.kind === 'system'}
				<SystemMessage text={item.text} />
			{:else}
				<ChatMessage message={item} />
			{/if}
		{/each}
	{/if}
</main>
