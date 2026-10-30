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
				return 'bg-ok';
			case 'error':
				return 'bg-danger';
			case 'connecting':
			default:
				return 'bg-warn';
		}
	});

	const textColor = $derived.by(() => {
		switch (status) {
			case 'online':
				return 'text-ok';
			case 'error':
				return 'text-danger';
			case 'connecting':
			default:
				return 'text-muted';
		}
	});
</script>

<span
	class="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap {textColor} {customClass}"
>
	<i class="inline-block h-2 w-2 rounded-full {dotColor}"></i>
	<span>{text}</span>
</span>
