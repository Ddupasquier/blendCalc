import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";

describe("ActionRequiredCountBadge", () => {
	it("keeps the exact accessible count when the visible count is capped", () => {
		render(ActionRequiredCountBadge, {
			props: {
				count: 105,
				label: "moderator actions requiring review",
			},
		});

		expect(screen.getByText("99+")).toHaveAccessibleName(
			"105 moderator actions requiring review",
		);
	});
});
