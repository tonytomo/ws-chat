<script lang="ts">
	import type { ChatFeedItem } from '#lib/types/protocol';
	import { formatClockTime } from '#lib/utils/formatters';

	interface Props {
		message: ChatFeedItem;
	}

	const { message }: Props = $props();

	function parseTokens(text: string) {
		const regex = /(@[a-zA-Z0-9_-]+)/g;
		const parts = text.split(regex);
		return parts.map((part) => ({
			isMention: part.startsWith('@') && part.length > 1,
			value: part
		}));
	}
</script>

{#if message.own}
	<!-- Outgoing Message (You) -->
	<div class="animate-pop ml-auto flex max-w-2xl items-start justify-end gap-3.5">
		<div class="flex flex-col items-end">
			<div class="mb-1.5 flex items-baseline gap-2 px-1">
				<span class="text-xs text-slate-500">{formatClockTime(message.ts)}</span>
				<span class="text-sm font-semibold text-emerald-300 sm:text-base">You</span>
			</div>

			<div
				class="rounded-2xl rounded-tr-sm border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-white shadow-lg shadow-emerald-950/50 sm:text-base"
			>
				{#each parseTokens(message.text) as token, i (i)}
					{#if token.isMention}
						<span class="font-semibold text-emerald-100 underline decoration-emerald-200/50">
							{token.value}
						</span>
					{:else}
						{token.value}
					{/if}
				{/each}
			</div>

			<div class="mt-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-slate-400">
				<span>Delivered</span>
				<span class="material-symbols-outlined text-sm text-emerald-400">done_all</span>
			</div>
		</div>
	</div>
{:else}
	<!-- Incoming Message (Other) -->
	<div class="animate-pop flex max-w-2xl items-start gap-3.5">
		<div class="flex w-full flex-col items-start">
			<div class="mb-1.5 flex items-baseline gap-2 px-1">
				<span class="text-sm font-semibold text-slate-200 sm:text-base">
					{message.from || 'Anonymous'}
				</span>
				<span class="text-xs text-slate-500">{formatClockTime(message.ts)}</span>
			</div>

			<div
				class="rounded-2xl rounded-tl-sm border border-slate-800/90 bg-[#151e2e]/90 px-5 py-3.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-200 shadow-md shadow-black/20 backdrop-blur-sm transition-colors hover:border-slate-700/80 sm:text-base"
			>
				{#each parseTokens(message.text) as token, i (i)}
					{#if token.isMention}
						<span class="cursor-pointer font-semibold text-emerald-400 hover:underline">
							{token.value}
						</span>
					{:else}
						{token.value}
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}
