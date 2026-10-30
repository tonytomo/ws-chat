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
		'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'primary':
				return 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl px-5 py-2.5 text-sm active:scale-[0.98] shadow-lg shadow-emerald-500/20';
			case 'danger':
				return 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl px-4 py-2 text-sm font-semibold active:scale-[0.98]';
			case 'icon':
				return 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg p-1.5 text-sm';
			case 'ghost':
			default:
				return 'bg-[#161f30] text-slate-300 border border-slate-700/60 hover:border-emerald-400/50 hover:bg-emerald-500 hover:text-slate-950 font-semibold rounded-xl px-4 py-2 text-sm';
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
