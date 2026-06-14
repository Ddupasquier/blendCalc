const DAILY_WELCOME_STORAGE_PREFIX = "smoothie-mixer:daily-welcome";

type DailyWelcomeStorage = Pick<Storage, "getItem" | "setItem">;

export const getLocalDateKey = (date = new Date()) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
};

export const getDailyWelcomeStorageKey = (userId: string) => {
	return `${DAILY_WELCOME_STORAGE_PREFIX}:${userId}`;
};

export const shouldShowDailyWelcome = (
	storage: DailyWelcomeStorage,
	userId: string,
	date = new Date(),
) => {
	const storageKey = getDailyWelcomeStorageKey(userId);
	const today = getLocalDateKey(date);

	try {
		if (storage.getItem(storageKey) === today) return false;

		storage.setItem(storageKey, today);
		return true;
	} catch {
		return true;
	}
};
