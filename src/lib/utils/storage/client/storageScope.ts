import { browser } from "$app/environment";

const ACTIVE_STORAGE_USER_KEY = "blendcalc-active-storage-user";
const OBSOLETE_SERVER_BACKED_STORAGE_KEYS = [
	"smoothie-fridge",
	"smoothie-shopping-list",
	"smoothie-custom-foods",
	"smoothie-saved-drinks",
	"smoothie-loaded-saved-drink",
];
const LEGACY_UNSCOPED_TRANSIENT_STORAGE_KEYS = [
	"smoothie-nutrient-goals",
	"smoothie-mix-state",
];
const OBSOLETE_CACHE_PREFIX = "smoothie-cache:";

let activeStorageUserId = "";

export const setActiveStorageUserId = (userId: string | null) => {
	activeStorageUserId = userId ?? "";

	if (!browser) return;

	if (activeStorageUserId) {
		sessionStorage.setItem(ACTIVE_STORAGE_USER_KEY, activeStorageUserId);
		return;
	}

	sessionStorage.removeItem(ACTIVE_STORAGE_USER_KEY);
};

export const getScopedStorageKey = (key: string) => {
	if (activeStorageUserId) return `${key}:user:${activeStorageUserId}`;
	if (!browser) return key;

	const storedUserId = sessionStorage.getItem(ACTIVE_STORAGE_USER_KEY);
	return storedUserId ? `${key}:user:${storedUserId}` : key;
};

export const clearObsoleteAppStorage = () => {
	if (!browser) return;
	const keysToRemove: string[] = [];

	for (let index = 0; index < localStorage.length; index += 1) {
		const storageKey = localStorage.key(index);
		if (!storageKey) continue;
		if (
			storageKey.startsWith(OBSOLETE_CACHE_PREFIX) ||
			OBSOLETE_SERVER_BACKED_STORAGE_KEYS.some(
				(key) => storageKey === key || storageKey.startsWith(`${key}:user:`),
			)
		) {
			keysToRemove.push(storageKey);
		}
	}

	for (const storageKey of keysToRemove) localStorage.removeItem(storageKey);
	for (const storageKey of LEGACY_UNSCOPED_TRANSIENT_STORAGE_KEYS) {
		localStorage.removeItem(storageKey);
	}
};
