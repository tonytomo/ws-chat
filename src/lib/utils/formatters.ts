/**
 * Formats a Unix timestamp (seconds) into a human-friendly relative time string.
 * Example: 'just now', '5m ago', '2h ago', '3d ago'.
 */
export function formatRelativeTime(unixSec?: number): string {
	if (!unixSec) return 'just now';
	const nowSec = Math.floor(Date.now() / 1000);
	const diffSec = Math.max(0, nowSec - unixSec);

	if (diffSec < 60) return 'just now';
	if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
	if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
	return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Formats a Unix timestamp (seconds) or current time into HH:MM.
 */
export function formatClockTime(unixSec?: number): string {
	const date = unixSec ? new Date(unixSec * 1000) : new Date();
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

