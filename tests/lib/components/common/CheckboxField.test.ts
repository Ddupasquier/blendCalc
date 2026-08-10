import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { createRawSnippet } from "svelte";
import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";

describe("CheckboxField", () => {
	it("uses the full label copy as the checkbox name", () => {
		render(CheckboxField, {
			props: {
				id: "sensitive-preferences",
				name: "sensitiveAcknowledged",
				checked: true,
				children: createRawSnippet(() => ({
					render: () => "<span>Use these settings for warnings.</span>",
				})),
			},
		});

		expect(
			screen.getByRole("checkbox", { name: "Use these settings for warnings." }),
		).toBeChecked();
	});
});
