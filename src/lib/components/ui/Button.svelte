<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'ghost' | 'danger' | 'icon';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		title?: string;
		ariaLabel?: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
	}

	const {
		variant = 'ghost',
		type = 'button',
		disabled = false,
		title,
		ariaLabel,
		class: customClass = '',
		onclick,
		children
	}: Props = $props();

	const baseClasses =
		'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed select-none';

	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'primary':
				return 'bg-accent text-accent-text hover:bg-accent-hover rounded-full px-4 py-2 text-sm font-semibold active:scale-[0.98] shadow-sm';
			case 'danger':
				return 'bg-danger text-white hover:bg-red-700 rounded-full px-4 py-2 text-sm font-semibold active:scale-[0.98] shadow-sm';
			case 'icon':
				return 'text-muted hover:text-danger hover:bg-danger/10 rounded-lg p-1.5 text-sm';
			case 'ghost':
			default:
				return 'bg-surface-2 text-text border border-border hover:bg-surface hover:border-muted rounded-full px-4 py-2 text-sm';
		}
	});
</script>

<button
	{type}
	{disabled}
	{title}
	aria-label={ariaLabel}
	{onclick}
	class="{baseClasses} {variantClasses} {customClass}"
>
	{#if children}
		{@render children()}
	{/if}
</button>

