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
				return 'text-danger bg-danger/10 border-danger/35';
			case 'warn':
				return 'text-warn bg-warn/15 border-warn/35';
			case 'info':
			default:
				return 'text-accent bg-accent/10 border-accent/35';
		}
	});
</script>

{#if banner}
	<div
		role="alert"
		class="mx-4 my-2 flex items-center justify-between gap-3 rounded-xl border p-3 text-xs font-medium md:text-sm {kindClasses} {customClass}"
	>
		<div class="flex-1 break-words">
			{banner.message}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if banner.canReconnect && onReconnect}
				<button
					type="button"
					onclick={onReconnect}
					class="rounded-lg border border-current bg-transparent px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
				>
					Reconnect
				</button>
			{/if}

			{#if banner.actionLabel && banner.onAction}
				<button
					type="button"
					onclick={banner.onAction}
					class="rounded-lg border border-current bg-transparent px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
				>
					{banner.actionLabel}
				</button>
			{/if}

			{#if onDismiss}
				<button
					type="button"
					onclick={onDismiss}
					aria-label="Dismiss banner"
					class="rounded-lg border border-current/40 bg-transparent px-2 py-0.5 text-xs font-semibold transition-opacity hover:border-current hover:opacity-80"
				>
					Dismiss
				</button>
			{/if}
		</div>
	</div>
{/if}
