<script lang="ts">
	import Modal from '#lib/components/ui/Modal.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { KIND_PRESETS, getDefaultEphemeralForKind, isValidRoomName } from '#lib/utils/validators';
	import type { RoomKind } from '#lib/types/protocol';

	interface Props {
		isOpen: boolean;
		isCreating?: boolean;
		errorMessage?: string;
		onClose: () => void;
		onSubmit: (data: {
			name: string;
			kind: RoomKind;
			passcode?: string;
			maxMembers?: number;
			ephemeral: boolean;
		}) => void;
	}

	const { isOpen, isCreating = false, errorMessage = '', onClose, onSubmit }: Props = $props();

	let name = $state('');
	let kind = $state<RoomKind>('chat');
	let passcode = $state('');
	let maxMembers = $state<number | undefined>(undefined);
	let isEphemeral = $state(false);
	let validationError = $state('');

	$effect(() => {
		if (isOpen) {
			name = '';
			kind = 'chat';
			passcode = '';
			maxMembers = undefined;
			isEphemeral = getDefaultEphemeralForKind('chat');
			validationError = '';
		}
	});

	function handleKindChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newKind = target.value as RoomKind;
		kind = newKind;
		isEphemeral = getDefaultEphemeralForKind(newKind);
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		validationError = '';

		const trimmedName = name.trim();
		if (!isValidRoomName(trimmedName)) {
			validationError = 'Invalid room name. Use 1–64 characters from a–z A–Z 0–9 _ -';
			return;
		}

		if (maxMembers !== undefined && maxMembers <= 0) {
			validationError = 'Max members must be a positive integer.';
			return;
		}

		onSubmit({
			name: trimmedName,
			kind,
			passcode: passcode.trim() || undefined,
			maxMembers: maxMembers || undefined,
			ephemeral: isEphemeral
		});
	}
</script>

<Modal {isOpen} title="Create a room" {onClose}>
	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		{#if validationError || errorMessage}
			<div
				class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs font-medium text-danger"
			>
				{validationError || errorMessage}
			</div>
		{/if}

		<div class="flex flex-col gap-1.5">
			<label for="cr-name" class="text-xs font-semibold text-text">Room name</label>
			<input
				id="cr-name"
				type="text"
				required
				maxlength="64"
				autocomplete="off"
				placeholder="e.g. arena-1"
				bind:value={name}
				class="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-text transition-all outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
			/>
			<span class="text-[11px] text-muted">1–64 chars from <code>a–z A–Z 0–9 _ -</code></span>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="cr-kind" class="text-xs font-semibold text-text">Kind</label>
			<select
				id="cr-kind"
				value={kind}
				onchange={handleKindChange}
				class="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-text transition-all outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
			>
				{#each Object.entries(KIND_PRESETS) as [key, preset] (key)}
					<option value={key}>
						{preset.label} — {preset.description}
					</option>
				{/each}
			</select>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="cr-passcode" class="text-xs font-semibold text-text">
				Passcode <span class="font-normal text-muted">(optional)</span>
			</label>
			<input
				id="cr-passcode"
				type="password"
				autocomplete="new-password"
				placeholder="Leave blank for public"
				bind:value={passcode}
				class="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-text transition-all outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
			/>
		</div>

		<div class="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5">
				<label for="cr-max" class="text-xs font-semibold text-text">
					Max members <span class="font-normal text-muted">(optional)</span>
				</label>
				<input
					id="cr-max"
					type="number"
					min="1"
					step="1"
					placeholder="Preset default"
					bind:value={maxMembers}
					class="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-text transition-all outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
				/>
			</div>

			<label
				class="mt-auto flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-2.5"
			>
				<input type="checkbox" bind:checked={isEphemeral} class="h-4 w-4 rounded accent-accent" />
				<span class="text-xs leading-tight font-semibold text-text">
					Ephemeral
					<small class="block text-[10px] font-normal text-muted">Delete when empty</small>
				</span>
			</label>
		</div>

		<div class="flex items-center justify-end gap-2 border-t border-border/50 pt-2">
			<Button variant="ghost" onclick={onClose} disabled={isCreating}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={isCreating}>
				{isCreating ? 'Creating…' : 'Create & open'}
			</Button>
		</div>
	</form>
</Modal>
