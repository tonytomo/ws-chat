<script lang="ts">
	import type { ConnectionStatus } from '#lib/types/protocol';

	interface Props {
		status: ConnectionStatus;
		text: string;
		class?: string;
	}

	const { status, text, class: customClass = '' }: Props = $props();

	const dotColor = $derived.by(() => {
		switch (status) {
			case 'online':
				return 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
			case 'error':
				return 'bg-red-400 shadow-[0_0_8px_#f87171]';
			case 'connecting':
			default:
				return 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
		}
	});

	const textColor = $derived.by(() => {
		switch (status) {
			case 'online':
				return 'text-emerald-400';
			case 'error':
				return 'text-red-400';
			case 'connecting':
			default:
				return 'text-slate-400';
		}
	});
</script>

<span
	class="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap {textColor} {customClass}"
>
	<i class="inline-block h-2 w-2 rounded-full {dotColor}"></i>
	<span>{text}</span>
</span>
