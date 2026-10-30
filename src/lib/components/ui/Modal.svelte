<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		isOpen: boolean;
		title: string;
		onClose: () => void;
		children?: Snippet;
		class?: string;
	}

	const { isOpen, title, onClose, children, class: customClass = '' }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (isOpen && e.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			class="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111827] p-6 text-slate-100 shadow-2xl shadow-black/80 transition-all {customClass}"
		>
			<header class="flex items-center justify-between border-b border-slate-800 pb-4">
				<h2 id="modal-title" class="text-lg font-bold tracking-tight text-slate-100">
					{title}
				</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close modal"
					class="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#161f30] hover:text-slate-100"
				>
					<span class="material-symbols-outlined text-lg leading-none">close</span>
				</button>
			</header>

			<div class="mt-4">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	</div>
{/if}
