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
				return 'px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 border-amber-500/20';
			case 'kind':
				return 'px-2.5 py-0.5 text-xs capitalize bg-slate-800/80 text-slate-400 border-slate-700/60';
			default:
				return 'px-2.5 py-0.5 text-xs bg-[#161f30] text-slate-300 border-slate-800';
		}
	});
</script>

<span
	{title}
	class="inline-flex items-center gap-1 rounded-full border font-semibold {variantClasses} {customClass}"
>
	{#if children}
		{@render children()}
	{/if}
</span>
