<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { configStore } from '#lib/stores/configStore.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		configStore.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Game Chat</title>
</svelte:head>

<div
	class="min-h-dvh bg-[#090d16] font-sans text-slate-100 antialiased selection:bg-emerald-500 selection:text-black"
>
	{@render children()}
</div>
