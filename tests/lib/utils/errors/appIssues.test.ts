import { describe, expect, it } from "vitest";
import {
	createAppIssuePayload,
	getAppIssueMessage,
	getDefaultAppIssueCode,
	isAppIssueCode,
	normalizeAppIssueParams,
} from "$lib/utils/errors/appIssues";

describe("application issue catalog", () => {
	it("turns stable codes and safe parameters into friendly wording", () => {
		expect(
			getAppIssueMessage("NUTRIENT_CHILD_EXCEEDS_PARENT", {
				childLabel: "Saturated fat",
				parentLabel: "Total Fat",
			}),
		).toBe("Saturated fat cannot exceed total fat.");
		expect(
			getAppIssueMessage("PRODUCT_NAME_CONFLICT", {
				productName: "Roasted Onion & Garlic Pasta Sauce",
			}),
		).toContain("Roasted Onion & Garlic Pasta Sauce");
	});

	it("drops nested and excessive response parameters", () => {
		expect(normalizeAppIssueParams({
			productName: "  Example  ",
			debug: { relation: "private_table" },
			values: ["private"],
			count: 2,
		})).toEqual({
			productName: "Example",
			count: 2,
		});
	});

	it("recognizes only approved codes and maps uncoded statuses safely", () => {
		expect(isAppIssueCode("IMAGE_NOT_FOUND")).toBe(true);
		expect(isAppIssueCode("relation_missing")).toBe(false);
		expect(getDefaultAppIssueCode(404)).toBe("ROUTE_NOT_FOUND");
		expect(getDefaultAppIssueCode(500)).toBe("UNEXPECTED_ERROR");
	});

	it("creates a safe payload without technical error details", () => {
		expect(createAppIssuePayload("IMAGE_NOT_FOUND")).toEqual({
			code: "IMAGE_NOT_FOUND",
			message: "We couldn’t find this image. Refresh the page and try again.",
		});
	});
});
