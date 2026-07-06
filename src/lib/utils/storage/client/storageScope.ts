import { browser } from "$app/environment";

const ACTIVE_STORAGE_USER_KEY = "smoothie-active-storage-user";
const LEGACY_APP_STORAGE_KEYS = [
	"smoothie-fridge",
	"smoothie-shopping-list",
	"smoothie-nutrient-goals",
	"smoothie-mix-state",
	"smoothie-custom-foods",
	"smoothie-saved-drinks",
];

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

export const clearLegacyAppStorage = () => {
	if (!browser) return;
	LEGACY_APP_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};
