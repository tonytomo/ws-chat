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
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs transition-opacity"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			class="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-text shadow-2xl transition-all {customClass}"
		>
			<header class="flex items-center justify-between border-b border-border/50 pb-4">
				<h2 id="modal-title" class="text-lg font-bold tracking-tight text-text">
					{title}
				</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close modal"
					class="rounded-lg p-1 text-xl leading-none text-muted transition-colors hover:bg-surface-2 hover:text-text"
				>
					×
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
