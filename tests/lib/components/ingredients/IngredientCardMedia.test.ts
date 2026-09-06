import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const createFood = (): FoodItem => ({
	fdcId: 52,
	description: "Performance Test Sauce",
	foodNutrients: [],
	image: {
		source: "open-food-facts",
		role: "front",
		imageUrl: "https://images.example/product.400.jpg",
		thumbnailUrl: "https://images.example/product.200.jpg",
		licenseName: "CC BY-SA 3.0",
		confidence: "imported",
	},
});

describe("IngredientCardMedia", () => {
	it("uses the thumbnail first and retries the full image before its symbol fallback", async () => {
		const { container } = render(IngredientCardMedia, {
			props: { food: createFood() },
		});

		let image = container.querySelector("img");
		expect(image).toHaveAttribute(
			"src",
			"https://images.example/product.200.jpg",
		);
		await fireEvent.error(image!);

		image = container.querySelector("img");
		expect(image).toHaveAttribute(
			"src",
			"https://images.example/product.400.jpg",
		);
		await fireEvent.error(image!);

		expect(container.querySelector("img")).not.toBeInTheDocument();
		expect(
			container.querySelector(".ingredient-card-media__fallback"),
		).toBeInTheDocument();
	});

	it("uses the full image directly when no distinct thumbnail exists", () => {
		const food = createFood();
		delete food.image?.thumbnailUrl;
		const { container } = render(IngredientCardMedia, { props: { food } });

		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"https://images.example/product.400.jpg",
		);
	});
});
