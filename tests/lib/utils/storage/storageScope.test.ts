import { beforeEach, describe, expect, it } from "vitest";
import {
	clearObsoleteAppStorage,
	setActiveStorageUserId,
} from "$lib/utils/storage/client/storageScope";

describe("browser storage scope", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		setActiveStorageUserId("user-1");
	});

	it("removes obsolete database mirrors without deleting transient Mix state", () => {
		localStorage.setItem("smoothie-fridge:user:user-1", "[]");
		localStorage.setItem("smoothie-shopping-list:user:user-2", "[]");
		localStorage.setItem("smoothie-custom-foods", "[]");
		localStorage.setItem("smoothie-saved-drinks:user:user-1", "[]");
		localStorage.setItem("smoothie-loaded-saved-drink:user:user-1", "{}");
		localStorage.setItem("smoothie-cache:old-search", "{}");
		localStorage.setItem("smoothie-mix-state:user:user-1", "{}");
		localStorage.setItem("smoothie-nutrient-goals:user:user-1", "{}");
		localStorage.setItem("unrelated-app-key", "keep");

		clearObsoleteAppStorage();

		expect(localStorage.getItem("smoothie-fridge:user:user-1")).toBeNull();
		expect(localStorage.getItem("smoothie-shopping-list:user:user-2")).toBeNull();
		expect(localStorage.getItem("smoothie-custom-foods")).toBeNull();
		expect(localStorage.getItem("smoothie-saved-drinks:user:user-1")).toBeNull();
		expect(localStorage.getItem("smoothie-cache:old-search")).toBeNull();
		expect(localStorage.getItem("smoothie-mix-state:user:user-1")).toBe("{}");
		expect(localStorage.getItem("smoothie-nutrient-goals:user:user-1")).toBe("{}");
		expect(localStorage.getItem("unrelated-app-key")).toBe("keep");
	});
});
