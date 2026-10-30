<script lang="ts">
	import type { ChatFeedItem } from '#lib/types/protocol';
	import { formatClockTime } from '#lib/utils/formatters';

	interface Props {
		message: ChatFeedItem;
	}

	const { message }: Props = $props();
</script>

<div
	class="animate-pop flex max-w-[76%] flex-col gap-1 {message.own
		? 'items-end self-end'
		: 'items-start self-start'}"
>
	{#if !message.own && message.from}
		<span class="px-1 text-xs font-semibold text-muted">
			{message.from}
		</span>
	{/if}

	<div
		class="overflow-hidden rounded-2xl px-3.5 py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap shadow-xs {message.own
			? 'rounded-br-xs bg-bubble-own text-bubble-own-text'
			: 'rounded-bl-xs border border-border bg-bubble-other text-text'}"
	>
		{message.text}
	</div>

	<span class="px-1 text-[11px] text-muted">
		{formatClockTime(message.ts)}
	</span>
</div>
