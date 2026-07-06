/**
 * Lightweight localStorage cache with TTL support.
 * Uses a prefix to namespace blendCalc entries.
 */

const PREFIX = 'sm_cache_';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

const isAvailable = (): boolean => {
	try {
		const key = '__sm_test__';
		localStorage.setItem(key, '1');
		localStorage.removeItem(key);
		return true;
	} catch {
		return false;
	}
};

export const cacheGet = <T>(key: string): T | null => {
	if (!isAvailable()) return null;
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return null;
		const entry: CacheEntry<T> = JSON.parse(raw);
		if (Date.now() > entry.expiresAt) {
			localStorage.removeItem(PREFIX + key);
			return null;
		}
		return entry.data;
	} catch {
		return null;
	}
};

export const cacheSet = <T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void => {
	if (!isAvailable()) return;
	try {
		const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
		localStorage.setItem(PREFIX + key, JSON.stringify(entry));
	} catch {
		// Storage quota exceeded or unavailable — fail silently
	}
};

export const cacheDelete = (key: string): void => {
	if (!isAvailable()) return;
	try {
		localStorage.removeItem(PREFIX + key);
	} catch {
		// ignore
	}
};

export const cacheClearAll = (): void => {
	try {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
		keys.forEach((k) => localStorage.removeItem(k));
	} catch {
		// ignore
	}
};
