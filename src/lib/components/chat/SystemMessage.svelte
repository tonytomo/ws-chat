<script lang="ts">
	interface Props {
		text: string;
	}

	const { text }: Props = $props();
</script>

<div
	class="my-1 max-w-[90%] self-center rounded-full border border-border bg-surface-2 px-3 py-1 text-center text-xs text-muted select-none"
>
	{text}
</div>
