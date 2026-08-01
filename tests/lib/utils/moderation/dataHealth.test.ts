import { describe, expect, it } from "vitest";
import { parseModeratorDataHealth } from "$lib/utils/moderation/dataHealth";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";

describe("moderator data-health parser", () => {
	it("accepts the bounded dashboard contract", () => {
		expect(parseModeratorDataHealth(moderatorDataHealthFixture))
			.toEqual(moderatorDataHealthFixture);
	});

	it("rejects malformed aggregate values rather than inventing defaults", () => {
		expect(() => parseModeratorDataHealth({
			...moderatorDataHealthFixture,
			overview: {
				...moderatorDataHealthFixture.overview,
				activeProducts: "16",
			},
		})).toThrow(/overview\.activeProducts/u);
	});
});
