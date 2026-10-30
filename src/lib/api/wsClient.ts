import type { InboundMessage, OutboundPayload } from '#lib/types/protocol';

export interface WSClientOptions {
	apiKey: string;
	wsOverride?: string;
	onOpen?: () => void;
	onMessage?: (msg: InboundMessage) => void;
	onClose?: (event: CloseEvent, isClosedByUs: boolean) => void;
	onError?: (error: Event) => void;
	onStaleConnection?: () => void;
}

export class WSClient {
	private ws: WebSocket | null = null;
	private options: WSClientOptions;
	private isClosedByUs = false;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private pongTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: WSClientOptions) {
		this.options = options;
	}

	public get isConnected(): boolean {
		return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
	}

	public get readyState(): number {
		return this.ws ? this.ws.readyState : WebSocket.CLOSED;
	}

	public buildUrl(): string {
		const { apiKey, wsOverride } = this.options;
		if (wsOverride) {
			const u = new URL(
				wsOverride,
				typeof window !== 'undefined' ? window.location.href : 'http://localhost'
			);
			u.searchParams.set('key', apiKey);
			return u.toString();
		}

		if (typeof window === 'undefined') return '';
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${proto}//${window.location.host}/ws?key=${encodeURIComponent(apiKey)}`;
	}

	public connect(): void {
		this.disconnect();
		this.isClosedByUs = false;

		const url = this.buildUrl();
		if (!url) return;

		try {
			this.ws = new WebSocket(url);
		} catch (err) {
			if (this.options.onError) {
				this.options.onError(err as Event);
			}
			return;
		}

		this.ws.addEventListener('open', () => {
			this.options.onOpen?.();
		});

		this.ws.addEventListener('message', (ev) => {
			if (typeof ev.data !== 'string') return;
			this.clearPongTimer();

			let msg: InboundMessage;
			try {
				msg = JSON.parse(ev.data);
			} catch {
				return;
			}

			this.options.onMessage?.(msg);
		});

		this.ws.addEventListener('close', (ev) => {
			this.stopHeartbeat();
			const wasClosedByUs = this.isClosedByUs;
			this.ws = null;
			this.options.onClose?.(ev, wasClosedByUs);
		});

		this.ws.addEventListener('error', (ev) => {
			this.options.onError?.(ev);
		});
	}

	public send(payload: OutboundPayload): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return false;
		}
		this.ws.send(JSON.stringify(payload));
		return true;
	}

	public startHeartbeat(intervalMs = 25000, timeoutMs = 10000): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			if (!this.isConnected) return;
			this.send({ type: 'ping' });
			this.clearPongTimer();
			this.pongTimer = setTimeout(() => {
				this.options.onStaleConnection?.();
			}, timeoutMs);
		}, intervalMs);
	}

	public stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		this.clearPongTimer();
	}

	public clearPongTimer(): void {
		if (this.pongTimer) {
			clearTimeout(this.pongTimer);
			this.pongTimer = null;
		}
	}

	public disconnect(): void {
		this.isClosedByUs = true;
		this.stopHeartbeat();
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
		) {
			this.ws.close(1000, 'client disconnect');
		}
		this.ws = null;
	}
}
