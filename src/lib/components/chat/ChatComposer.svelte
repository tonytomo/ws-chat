<script lang="ts">
	interface Props {
		isLocked: boolean;
		roomName?: string;
		onSend: (text: string) => void;
	}

	const { isLocked, roomName = 'chat', onSend }: Props = $props();

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

<footer
	class="sticky bottom-0 border-t border-slate-800/80 bg-[#0b0f19]/85 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:px-6"
>
	<div class="mx-auto max-w-4xl">
		<form class="flex items-center gap-3" onsubmit={handleSubmit}>
			<div class="relative flex-1">
				<input
					bind:this={inputEl}
					bind:value={inputVal}
					disabled={isLocked}
					type="text"
					maxlength="2000"
					placeholder="Type your message in #{roomName}..."
					aria-label="Message input"
					class="w-full rounded-full border border-slate-800 bg-[#101726] py-3.5 pr-6 pl-5 text-base text-slate-100 shadow-inner transition-all outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:bg-[#151e2e] focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<button
				type="submit"
				title="Send message"
				aria-label="Send message"
				disabled={isLocked || !inputVal.trim()}
				class="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:from-emerald-500 hover:to-emerald-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<span class="material-symbols-outlined text-xl leading-none">send</span>
			</button>
		</form>
	</div>
</footer>
