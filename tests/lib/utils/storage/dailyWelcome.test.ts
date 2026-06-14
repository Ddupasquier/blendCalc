import { beforeEach, describe, expect, it } from "vitest";
import {
	getDailyWelcomeStorageKey,
	getLocalDateKey,
	shouldShowDailyWelcome,
} from "$lib/utils/storage/dailyWelcome";

describe("daily welcome storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("shows once per local calendar day", () => {
		const morning = new Date(2026, 5, 13, 8, 30);
		const evening = new Date(2026, 5, 13, 21, 45);

		expect(shouldShowDailyWelcome(localStorage, "user-1", morning)).toBe(true);
		expect(shouldShowDailyWelcome(localStorage, "user-1", evening)).toBe(false);
		expect(localStorage.getItem(getDailyWelcomeStorageKey("user-1"))).toBe(
			"2026-06-13",
		);
	});

	it("shows again on the next local calendar day", () => {
		expect(
			shouldShowDailyWelcome(localStorage, "user-1", new Date(2026, 5, 13)),
		).toBe(true);
		expect(
			shouldShowDailyWelcome(localStorage, "user-1", new Date(2026, 5, 14)),
		).toBe(true);
	});

	it("tracks different signed-in users independently", () => {
		const today = new Date(2026, 5, 13);

		expect(shouldShowDailyWelcome(localStorage, "user-1", today)).toBe(true);
		expect(shouldShowDailyWelcome(localStorage, "user-2", today)).toBe(true);
		expect(shouldShowDailyWelcome(localStorage, "user-1", today)).toBe(false);
	});

	it("uses local date parts instead of UTC date serialization", () => {
		const localDate = new Date(2026, 0, 2, 0, 5);

		expect(getLocalDateKey(localDate)).toBe("2026-01-02");
	});

	it("still shows when browser storage is unavailable", () => {
		const unavailableStorage = {
			getItem: () => {
				throw new Error("Storage unavailable");
			},
			setItem: () => {
				throw new Error("Storage unavailable");
			},
		};

		expect(
			shouldShowDailyWelcome(unavailableStorage, "user-1", new Date(2026, 5, 13)),
		).toBe(true);
	});
});
