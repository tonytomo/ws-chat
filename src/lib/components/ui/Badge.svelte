<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'lock' | 'kind';
		title?: string;
		class?: string;
		children?: Snippet;
	}

	const { variant = 'default', title, class: customClass = '', children }: Props = $props();

	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'lock':
				return 'px-1.5 py-0.5 text-xs';
			case 'kind':
				return 'px-2 py-0.5 text-xs capitalize';
			default:
				return 'px-2.5 py-0.5 text-xs';
		}
	});
</script>

<span
	{title}
	class="inline-flex items-center gap-1 rounded-full border border-border bg-surface font-semibold text-muted {variantClasses} {customClass}"
>
	{#if children}
		{@render children()}
	{/if}
</span>
