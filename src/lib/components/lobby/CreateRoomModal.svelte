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

		let trimmedName = name.trim();
		if (trimmedName.startsWith('#')) {
			trimmedName = trimmedName.slice(1);
		}

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

<Modal {isOpen} title="Create a Room" {onClose}>
	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		{#if validationError || errorMessage}
			<div
				class="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-medium text-red-300"
			>
				{validationError || errorMessage}
			</div>
		{/if}

		<div class="flex flex-col gap-1.5">
			<label for="cr-name" class="text-xs font-semibold text-slate-300">Room name</label>
			<div class="relative">
				<span class="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-500">
					#
				</span>
				<input
					id="cr-name"
					type="text"
					required
					maxlength="64"
					autocomplete="off"
					placeholder="e.g. design-critique"
					bind:value={name}
					class="w-full rounded-xl border border-slate-800 bg-[#161f30] py-2.5 pr-4 pl-8 text-sm font-medium text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80 focus:bg-[#161f30]/90"
				/>
			</div>
			<span class="text-[11px] text-slate-500">1–64 chars from <code>a–z A–Z 0–9 _ -</code></span>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="cr-kind" class="text-xs font-semibold text-slate-300">Kind</label>
			<select
				id="cr-kind"
				value={kind}
				onchange={handleKindChange}
				class="w-full rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5 text-sm text-slate-100 transition-all outline-none focus:border-emerald-400/80"
			>
				{#each Object.entries(KIND_PRESETS) as [key, preset] (key)}
					<option value={key} class="bg-[#111827] text-slate-100">
						{preset.label} — {preset.description}
					</option>
				{/each}
			</select>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="cr-passcode" class="text-xs font-semibold text-slate-300">
				Passcode <span class="font-normal text-slate-500">(optional)</span>
			</label>
			<input
				id="cr-passcode"
				type="password"
				autocomplete="new-password"
				placeholder="Leave blank for public"
				bind:value={passcode}
				class="w-full rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5 text-sm text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80"
			/>
		</div>

		<div class="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5">
				<label for="cr-max" class="text-xs font-semibold text-slate-300">
					Max members <span class="font-normal text-slate-500">(optional)</span>
				</label>
				<input
					id="cr-max"
					type="number"
					min="1"
					step="1"
					placeholder="Preset default"
					bind:value={maxMembers}
					class="w-full rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5 text-sm text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80"
				/>
			</div>

			<label
				class="mt-auto flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-[#161f30] p-2.5"
			>
				<input
					type="checkbox"
					bind:checked={isEphemeral}
					class="h-4 w-4 rounded accent-emerald-500"
				/>
				<span class="text-xs leading-tight font-semibold text-slate-200">
					Ephemeral
					<small class="block text-[10px] font-normal text-slate-400">Delete when empty</small>
				</span>
			</label>
		</div>

		<div class="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-3">
			<Button variant="ghost" onclick={onClose} disabled={isCreating}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={isCreating}>
				{isCreating ? 'Creating…' : 'Create & Open'}
			</Button>
		</div>
	</form>
</Modal>
