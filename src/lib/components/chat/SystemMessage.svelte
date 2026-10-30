<script lang="ts">
	interface Props {
		text: string;
	}

	const { text }: Props = $props();
</script>

<div class="my-2 flex items-center justify-center">
	<span
		class="rounded-full border border-slate-800 bg-slate-900/90 px-4 py-1 text-xs font-semibold tracking-wide text-slate-400 shadow-sm select-none"
	>
		{text}
	</span>
</div>
