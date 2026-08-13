import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	test,
	waitForAppReady,
} from "./support/browserTest";

const openMixGoals = async (page: import("@playwright/test").Page) => {
	const goalsSection = page.locator("[data-tutorial-target='mix-goals']");
	const details = goalsSection.locator(":scope > details");
	const summary = details.locator(":scope > summary");
	if ((await details.getAttribute("open")) === null) await summary.click();
	await expect(details).toHaveAttribute("open", "");
	return { details, goalsSection, summary };
};

test("compact Mix header follows main-page scroll direction", async ({
	page,
}, testInfo) => {
	test.skip(
		!testInfo.project.name.startsWith("mobile-"),
		"Compact header behavior is a phone-layout contract.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	await expectCompactHeaderHidesAndRevealsWithScroll(
		page.locator(".view-top").first(),
		page.locator(".mix-page"),
	);
});

test("Mix disclosures expose animated open and closed state", async ({ page }) => {
	await page.goto("/mix");
	await waitForAppReady(page);
	const { details, summary } = await openMixGoals(page);
	await expect(summary).toHaveAttribute("aria-expanded", "true");
	await expect(details).toHaveAttribute("data-surface", "panel");
	await expect(summary.locator(".disclosure-chevron")).toHaveCSS(
		"transform",
		"matrix(0, 1, -1, 0, 0, 0)",
	);
	await summary.click();
	await expect(details).not.toHaveAttribute("open", "");
	await expect(summary).toHaveAttribute("aria-expanded", "false");
	await expect(summary.locator(".disclosure-chevron")).toHaveCSS(
		"transform",
		"matrix(1, 0, 0, 1, 0, 0)",
	);
	await summary.click();
	await expect(details).toHaveAttribute("open", "");
});

test("the shared styled select supports keyboard navigation and Escape", async ({
	page,
}) => {
	await page.goto("/mix");
	await waitForAppReady(page);
	await openMixGoals(page);

	const preset = page.getByRole("combobox", { name: "Goal preset" });
	const nativePreset = page.locator('select[name="goal-template"]');
	await expect(nativePreset).toHaveValue("");
	await preset.focus();
	await preset.press("ArrowDown");
	await expect(preset).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("option", { name: "Balanced" })).toBeVisible();
	await preset.press("Escape");
	await expect(preset).toHaveAttribute("aria-expanded", "false");
	await expect(preset).toBeFocused();

	await preset.press("ArrowDown");
	await preset.press("ArrowDown");
	await preset.press("Enter");
	await expect(preset).toContainText("Balanced");
	await expect(nativePreset).not.toHaveValue("");
	expect(
		await nativePreset.locator("option:checked").textContent(),
	).toContain("Balanced");
	await expect(page.getByText("Moderate calories, protein, carbs, fiber, and sugar.")).toBeVisible();
});

test("goal sliders and number inputs stay synchronized", async ({ page }, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary state mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	await openMixGoals(page);

	const slider = page.getByRole("slider", { name: "Set Calories goal" });
	const input = page.getByRole("spinbutton", {
		name: "Goal value for Calories in kcal",
	});
	const originalValue = await slider.inputValue();
	await expect(slider).toHaveAttribute("max", "700");
	await expect(slider).toHaveAttribute(
		"aria-valuetext",
		/=350 kcal goal; .* kcal current/,
	);
	const fillPercent = await slider
		.locator("xpath=..")
		.locator(".range-input__fill")
		.evaluate((element) =>
			Number.parseFloat((element as HTMLElement).style.width),
		);
	expect(fillPercent).toBeGreaterThan(0);
	expect(fillPercent).toBeLessThanOrEqual(100);
	await slider.focus();
	await slider.press("ArrowRight");
	await expect(input).not.toHaveValue(originalValue);
	await expect(slider).toHaveValue(await input.inputValue());
	await slider.press("ArrowLeft");
	await expect(input).toHaveValue(originalValue);
	await expect(slider).toHaveValue(originalValue);

	await input.click();
	await page.keyboard.type("475");
	await expect(input).toHaveValue("475");
	await expect(slider).toHaveValue("475");
	await input.fill(originalValue);
	await expect(slider).toHaveValue(originalValue);
});

test("closed Mix warnings retain visible severity and open on demand", async ({
	page,
}) => {
	await page.goto("/mix");
	await waitForAppReady(page);
	const warningsSection = page.locator(".mix-warnings");
	const details = warningsSection.locator(":scope > details");
	const summary = details.locator(":scope > summary");
	const initiallyOpen = (await details.getAttribute("open")) !== null;
	if (initiallyOpen) await summary.click();
	await expect(details).not.toHaveAttribute("open", "");
	await expect(details).toHaveAttribute("data-tone", "neutral");
	await expect(warningsSection).toHaveAttribute(
		"data-attention-tone",
		/warning|danger/,
	);
	await expect(summary).toHaveAttribute("aria-expanded", "false");
	await summary.click();
	await expect(details).toHaveAttribute("open", "");
	if (!initiallyOpen) await summary.click();
});

test("selected ingredients progressively load and can be filtered", async ({ page }) => {
	await page.goto("/mix");
	await waitForAppReady(page);

	const selectedSection = page.locator(".selected-ingredients-panel");
	const details = selectedSection.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await selectedSection.evaluate(async (element) => {
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});

	const cards = selectedSection.locator(".mix-ingredient-amount-card");
	const initialCardCount = await cards.count();
	const loadMore = selectedSection.getByRole("button", {
		name: "Load more selected ingredients",
	});
	await expect(loadMore).toBeVisible();
	await expect(loadMore).toBeEnabled();
	await loadMore.click();
	await expect.poll(() => cards.count()).toBeGreaterThan(initialCardCount);

	const search = selectedSection.getByRole("searchbox", {
		name: "Find selected ingredients",
	});
	await search.fill("Mango");
	await expect(selectedSection.getByText(/1 of 10 selected/i)).toBeVisible();
	await expect(cards).toHaveCount(1);
});

test("the reusable segmented control switches Mix ingredient sources by pointer and keyboard", async ({
	page,
}) => {
	await page.goto("/mix");
	await waitForAppReady(page);

	const chooser = page.locator(".ingredient-chooser");
	const details = chooser.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	const fridgeTab = chooser.getByRole("tab", { name: /Fridge/ });
	const shoppingTab = chooser.getByRole("tab", { name: /Shopping List/ });
	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
	await shoppingTab.click();
	await expect(shoppingTab).toHaveAttribute("aria-selected", "true");
	await shoppingTab.focus();
	await shoppingTab.press("ArrowLeft");
	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
});

test("Mix ingredient cards use their full surface for selection and restore state", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary Mix-state mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	const chooser = page.locator(".ingredient-chooser");
	const details = chooser.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await chooser.getByRole("searchbox", { name: "Find ingredients" }).fill("Mango");
	const mango = chooser.getByRole("button", {
		name: "Remove Mango, Raw from this mix",
	});
	await mango.click();
	const addMango = chooser.getByRole("button", {
		name: "Add Mango, Raw to this mix",
	});
	await expect(addMango).toHaveAttribute("aria-pressed", "false");
	await addMango.click();
	await expect(
		chooser.getByRole("button", { name: "Remove Mango, Raw from this mix" }),
	).toHaveAttribute("aria-pressed", "true");
});

test("selected ingredient amount controls change once and restore the original value", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary Mix-state mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	const selectedSection = page.locator(".selected-ingredients-panel");
	const details = selectedSection.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await selectedSection
		.getByRole("searchbox", { name: "Find selected ingredients" })
		.fill("Mango");
	const quantity = selectedSection.getByRole("spinbutton", {
		name: "Quantity for Mango, Raw",
	});
	const originalValue = await quantity.inputValue();
	await selectedSection.getByRole("button", { name: "Use more Mango, Raw" }).click();
	await expect(quantity).not.toHaveValue(originalValue);
	await selectedSection.getByRole("button", { name: "Use less Mango, Raw" }).click();
	await expect(quantity).toHaveValue(originalValue);
});

test("the nutrient picker searches the complete DB-backed catalog and requires an explicit target", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary goal mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	const { goalsSection } = await openMixGoals(page);
	await goalsSection.getByText("Add nutrient", { exact: true }).click();
	await expect(
		goalsSection.getByRole("button", { name: /Magnesium, Mg MG/i }),
	).toBeVisible();
	await expect(goalsSection.getByText(/\d+ nutrients$/)).toBeVisible();
	const search = goalsSection.getByRole("searchbox", { name: "Find a nutrient" });
	await search.fill("magnesium");
	await goalsSection.getByRole("button", { name: /Magnesium, Mg MG/i }).click();
	await expect(
		goalsSection.getByText(/There is no reviewed default for this nutrient/i),
	).toBeVisible();
	const target = goalsSection.getByRole("spinbutton", {
		name: /Goal value for Magnesium, Mg in MG/i,
	});
	await target.fill("125");
	await goalsSection.getByRole("button", { name: "Add goal" }).click();
	await expect(
		goalsSection.getByRole("slider", { name: "Set Magnesium, Mg goal" }),
	).toBeVisible();

	await search.fill("magnesium");
	await expect(goalsSection.getByText("No matching nutrients.")).toBeVisible();
	await goalsSection
		.getByRole("button", { name: "Stop tracking Magnesium, Mg" })
		.click();
});

test("Mix options expose keyboard reorganization and restore the section order", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary layout mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	await page.getByRole("button", { name: "Open mix options" }).click();
	await expect(page.getByRole("dialog", { name: "Mix options" })).toBeVisible();
	await page.getByRole("button", { name: "Reorganize" }).click();
	await expect(page).toHaveURL(/\/mix\/reorganize$/);
	const organizer = page.getByRole("region", { name: "Reorganize sections" });
	const nutrientShapeHandle = organizer.getByRole("button", {
		name: "Drag Nutrient shape to reorder",
	});
	const readSectionOrder = () =>
		organizer.locator("[data-mix-section-id]").evaluateAll((elements) =>
			elements.map((element) =>
				element.getAttribute("data-mix-section-id"),
			),
		);
	const initialOrder = await readSectionOrder();
	const initialPosition = initialOrder.indexOf("nutrient-shape");
	expect(initialPosition).toBeGreaterThanOrEqual(0);
	const movementKey =
		initialPosition === initialOrder.length - 1 ? "ArrowUp" : "ArrowDown";
	const returnKey = movementKey === "ArrowDown" ? "ArrowUp" : "ArrowDown";
	const movedPosition = initialPosition + (movementKey === "ArrowDown" ? 1 : -1);
	await nutrientShapeHandle.focus();
	await nutrientShapeHandle.press(movementKey);
	await expect(
		organizer.getByText(
			new RegExp(`moved to position ${movedPosition + 1} of`, "i"),
		),
	).toBeVisible();
	await expect
		.poll(async () => (await readSectionOrder()).indexOf("nutrient-shape"))
		.toBe(movedPosition);
	await nutrientShapeHandle.focus();
	await nutrientShapeHandle.press(returnKey);
	await expect(
		organizer.getByText(
			new RegExp(`moved to position ${initialPosition + 1} of`, "i"),
		),
	).toBeVisible();
	await expect.poll(readSectionOrder).toEqual(initialOrder);
	await organizer.getByRole("button", { name: "Done" }).click();
	await expect(page).toHaveURL(/\/mix$/);
});

test("the Mix save dialog accepts text and cancels without saving", async ({ page }) => {
	await page.goto("/mix");
	await waitForAppReady(page);
	await page.getByRole("button", { name: "Save mix" }).click();

	const dialog = page.getByRole("dialog", { name: /Save/i });
	await expect(dialog).toBeVisible();
	const nameInput = dialog.getByLabel("Mix name");
	await nameInput.fill("Playwright draft recipe");
	await expect(nameInput).toHaveValue("Playwright draft recipe");
	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(dialog).toBeHidden();
});
