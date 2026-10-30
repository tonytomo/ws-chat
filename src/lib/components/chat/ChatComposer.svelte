<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';

	interface Props {
		isLocked: boolean;
		onSend: (text: string) => void;
	}

	const { isLocked, onSend }: Props = $props();

	let inputVal = $state('');
	let inputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (!isLocked && inputEl) {
			inputEl.focus();
		}
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = inputVal.trim();
		if (!trimmed || isLocked) return;
		onSend(trimmed);
		inputVal = '';
		inputEl?.focus();
	}
</script>

<form
	onsubmit={handleSubmit}
	autocomplete="off"
	class="flex shrink-0 items-center gap-2 border-t border-border bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
>
	<input
		bind:this={inputEl}
		bind:value={inputVal}
		type="text"
		maxlength="2000"
		placeholder="Message"
		aria-label="Message"
		disabled={isLocked}
		class="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-text transition-all outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
	/>

	<Button variant="primary" type="submit" disabled={isLocked || !inputVal.trim()}>Send</Button>
</form>
