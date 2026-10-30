<script lang="ts">
	import type { ChatFeedItem } from '#lib/types/protocol';
	import { formatChatDate } from '#lib/utils/formatters';
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

	function getDayKey(ts?: number) {
		if (!ts) return '';
		const d = new Date(ts * 1000);
		return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
	aria-label="Message feed"
	class="no-scrollbar mx-auto flex w-full max-w-4xl flex-1 flex-col space-y-6 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
>
	{#if messages.length === 0}
		<div class="m-auto flex flex-col items-center justify-center p-8 text-center select-none">
			<div
				class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-sm"
			>
				<span class="material-symbols-outlined text-2xl leading-none">forum</span>
			</div>
			<h3 class="text-sm font-semibold text-slate-200">No messages yet</h3>
			<p class="mt-1 text-xs text-slate-500">Be the first to say hello 👋</p>
		</div>
	{:else}
		{#each messages as item, index (item.id)}
			{#if index === 0 || getDayKey(item.ts) !== getDayKey(messages[index - 1]?.ts)}
				<div class="my-2 flex items-center justify-center">
					<span
						class="rounded-full border border-slate-800 bg-slate-900/90 px-4 py-1 text-xs font-semibold tracking-wide text-slate-400 shadow-sm"
					>
						{formatChatDate(item.ts)}
					</span>
				</div>
			{/if}

			{#if item.kind === 'system'}
				<SystemMessage text={item.text} />
			{:else}
				<ChatMessage message={item} />
			{/if}
		{/each}
	{/if}
</main>
