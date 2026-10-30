import { SvelteURLSearchParams } from 'svelte/reactivity';

const KEY_STORE = 'ws.apiKey';
const WS_STORE = 'ws.endpoint';

export function createConfigStore() {
	let apiKey = $state<string>('');
	let wsOverride = $state<string>('');
	let isInitialized = $state<boolean>(false);

	const hasKey = $derived(Boolean(apiKey.trim()));

	function init() {
		if (typeof window === 'undefined') return;

		const params = new SvelteURLSearchParams(window.location.search);
		const urlKey = (params.get('key') || params.get('apikey') || '').trim();
		const urlWs = (params.get('ws') || '').trim();

		if (urlKey) localStorage.setItem(KEY_STORE, urlKey);
		if (urlWs) localStorage.setItem(WS_STORE, urlWs);

		apiKey = urlKey || localStorage.getItem(KEY_STORE) || '';
		wsOverride = urlWs || localStorage.getItem(WS_STORE) || '';
		isInitialized = true;

		// Scrub sensitive parameters from address bar while preserving room, passcode, etc.
		if (urlKey || urlWs) {
			params.delete('key');
			params.delete('apikey');
			params.delete('ws');
			const qs = params.toString();
			const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
			window.history.replaceState(null, '', newUrl);
		}
	}

	function setApiKey(newKey: string) {
		const trimmed = newKey.trim();
		apiKey = trimmed;
		if (typeof window !== 'undefined') {
			if (trimmed) {
				localStorage.setItem(KEY_STORE, trimmed);
			} else {
				localStorage.removeItem(KEY_STORE);
			}
		}
	}

	function setWsOverride(newWs: string) {
		const trimmed = newWs.trim();
		wsOverride = trimmed;
		if (typeof window !== 'undefined') {
			if (trimmed) {
				localStorage.setItem(WS_STORE, trimmed);
			} else {
				localStorage.removeItem(WS_STORE);
			}
		}
	}

	function clear() {
		apiKey = '';
		wsOverride = '';
		if (typeof window !== 'undefined') {
			localStorage.removeItem(KEY_STORE);
			localStorage.removeItem(WS_STORE);
		}
	}

	return {
		get apiKey() {
			return apiKey;
		},
		get wsOverride() {
			return wsOverride;
		},
		get hasKey() {
			return hasKey;
		},
		get isInitialized() {
			return isInitialized;
		},
		init,
		setApiKey,
		setWsOverride,
		clear
	};
}

export const configStore = createConfigStore();
