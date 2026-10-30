<script lang="ts">
	import type { BannerState } from '#lib/types/protocol';

	interface Props {
		banner: BannerState | null;
		onDismiss?: () => void;
		onReconnect?: () => void;
		class?: string;
	}

	const { banner, onDismiss, onReconnect, class: customClass = '' }: Props = $props();

	const kindClasses = $derived.by(() => {
		if (!banner) return '';
		switch (banner.kind) {
			case 'error':
				return 'text-red-300 bg-red-950/40 border-red-500/30';
			case 'warn':
				return 'text-amber-300 bg-amber-950/40 border-amber-500/30';
			case 'info':
			default:
				return 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30';
		}
	});
</script>

{#if banner}
	<div
		role="alert"
		class="mx-4 my-2 flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs font-medium shadow-lg shadow-black/20 backdrop-blur-md md:text-sm {kindClasses} {customClass}"
	>
		<div class="flex-1 wrap-break-word">
			{banner.message}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if banner.canReconnect && onReconnect}
				<button
					type="button"
					onclick={onReconnect}
					class="cursor-pointer rounded-xl border border-current bg-transparent px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
				>
					Reconnect
				</button>
			{/if}

			{#if banner.actionLabel && banner.onAction}
				<button
					type="button"
					onclick={banner.onAction}
					class="cursor-pointer rounded-xl border border-current bg-transparent px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
				>
					{banner.actionLabel}
				</button>
			{/if}

			{#if onDismiss}
				<button
					type="button"
					onclick={onDismiss}
					aria-label="Dismiss banner"
					class="cursor-pointer rounded-xl border border-current/40 bg-transparent px-2.5 py-1 text-xs font-semibold transition-opacity hover:border-current hover:opacity-80"
				>
					Dismiss
				</button>
			{/if}
		</div>
	</div>
{/if}
