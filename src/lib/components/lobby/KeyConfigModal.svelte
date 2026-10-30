<script lang="ts">
	import Modal from '#lib/components/ui/Modal.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { configStore } from '#lib/stores/configStore.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSaved: () => void;
	}

	const { isOpen, onClose, onSaved }: Props = $props();

	let inputKey = $state('');
	let inputWs = $state('');

	$effect(() => {
		if (isOpen) {
			inputKey = configStore.apiKey;
			inputWs = configStore.wsOverride;
		}
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		configStore.setApiKey(inputKey);
		configStore.setWsOverride(inputWs);
		onSaved();
		onClose();
	}

	function handleClear() {
		configStore.clear();
		inputKey = '';
		inputWs = '';
		onSaved();
		onClose();
	}
</script>

<Modal {isOpen} title="API & Endpoint Settings" {onClose}>
	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<label for="cfg-key" class="text-xs font-semibold text-slate-300">API Key</label>
			<input
				id="cfg-key"
				type="text"
				placeholder="e.g. k_alice_..."
				bind:value={inputKey}
				class="w-full rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5 font-mono text-sm text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80"
			/>
			<span class="text-[11px] text-slate-500">
				You can also supply this via URL parameter <code>?key=YOUR_KEY</code>.
			</span>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="cfg-ws" class="text-xs font-semibold text-slate-300">
				WebSocket Endpoint Override <span class="font-normal text-slate-500">(optional)</span>
			</label>
			<input
				id="cfg-ws"
				type="text"
				placeholder="Default: /ws (relative to origin)"
				bind:value={inputWs}
				class="w-full rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5 font-mono text-sm text-slate-100 transition-all outline-none placeholder:text-slate-500 focus:border-emerald-400/80"
			/>
		</div>

		<div class="flex items-center justify-between border-t border-slate-800/80 pt-3">
			<button
				type="button"
				onclick={handleClear}
				class="cursor-pointer text-xs font-semibold text-red-400 hover:underline"
			>
				Clear saved credentials
			</button>

			<div class="flex items-center gap-2">
				<Button variant="ghost" onclick={onClose}>Cancel</Button>
				<Button variant="primary" type="submit">Save & Reconnect</Button>
			</div>
		</div>
	</form>
</Modal>
