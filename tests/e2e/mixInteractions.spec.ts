import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	test,
	waitForAppReady,
} from "./support/browserTest";
import {
	captureLocalQaMixGoalConfiguration,
	restoreLocalQaMixGoalConfiguration,
	saveLocalQaMixState,
} from "./support/localQaDatabase";
import { getLocalQaAccountForWorker } from "./support/localQaAccounts";

const openMixGoals = async (page: import("@playwright/test").Page) => {
	const goalsSection = page.locator("[data-tutorial-target='mix-goals']");
	const details = goalsSection.locator(":scope > details");
	const summary = details.locator(":scope > summary");
	if ((await details.getAttribute("open")) === null) await summary.click();
	await expect(details).toHaveAttribute("open", "");
	await expect
		.poll(() => details.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	return { details, goalsSection, summary };
};

const selectGoalPreset = async (
	page: import("@playwright/test").Page,
	presetName: string,
) => {
	const preset = page.getByRole("combobox", { name: "Goal preset" });
	await preset.click();
	await page.getByRole("option", { name: presetName, exact: true }).click();
	await expect(preset).toContainText(presetName);
};

const openMixSection = async (
	page: import("@playwright/test").Page,
	selector: string,
) => {
	const section = page.locator(selector);
	const details = section.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await expect(details).toHaveAttribute("open", "");
	await expect
		.poll(() => details.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	return section;
};

const readRenderedMixGoals = (
	goalsSection: import("@playwright/test").Locator,
) =>
	goalsSection.locator(".goal-input").evaluateAll((goalCards) =>
		goalCards.map((goalCard) => ({
			name:
				goalCard.querySelector(".goal-label")?.textContent?.trim() ?? "",
			rule:
				(goalCard.querySelector(
					".goal-input__type .select-field__native",
				) as HTMLSelectElement | null)?.value ?? "",
			target:
				(goalCard.querySelector(
					".goal-input__number",
				) as HTMLInputElement | null)?.value ?? "",
			unit:
				goalCard.querySelector(".goal-unit")?.textContent?.trim() ?? "",
		})),
	);

const addExplicitNutrientGoal = async ({
	goalsSection,
	search,
	searchTerm,
	nutrientLabel,
	unit,
	targetAmount,
}: {
	goalsSection: import("@playwright/test").Locator;
	search: import("@playwright/test").Locator;
	searchTerm: string;
	nutrientLabel: string;
	unit: string;
	targetAmount: string;
}) => {
	await search.fill(searchTerm);
	const result = goalsSection
		.locator(".nutrient-picker__results button")
		.filter({ hasText: nutrientLabel })
		.first();
	await expect(result).toBeVisible();
	await expect(result).toContainText(unit);
	await result.click();
	await expect(
		goalsSection.getByText(
			`There is no reviewed default for this nutrient. Enter the target you want Mix to track.`,
		),
	).toBeVisible();
	const addGoal = goalsSection.getByRole("button", { name: "Add goal" });
	await expect(addGoal).toBeDisabled();
	const target = goalsSection.getByRole("spinbutton", {
		name: new RegExp(`Goal value for ${nutrientLabel} in ${unit}`, "i"),
	});
	await target.fill(targetAmount);
	await expect(target).toHaveValue(targetAmount);
	await expect(addGoal).toBeEnabled();
	await addGoal.click();
	await expect(
		goalsSection.getByRole("slider", {
			name: `Set ${nutrientLabel} goal`,
		}),
	).toBeVisible();
};

const selectGoalRule = async (
	goalsSection: import("@playwright/test").Locator,
	nutrientLabel: string,
	ruleLabel: string,
) => {
	const rule = goalsSection.getByRole("combobox", {
		name: `Goal rule for ${nutrientLabel}`,
	});
	await rule.click();
	await goalsSection.getByRole("option", { name: ruleLabel, exact: true }).click();
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

test("goal presets preserve explicit extras only when requested and survive a new session", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this durable goal mutation.",
	);

	const originalGoalConfiguration =
		await captureLocalQaMixGoalConfiguration(testInfo.parallelIndex);
	try {
		await page.goto("/mix");
		await waitForAppReady(page);
		const { goalsSection } = await openMixGoals(page);

		await selectGoalPreset(page, "Balanced");
		const balancedPreview = goalsSection.locator(".goal-template-preview");
		await expect(balancedPreview).toContainText(
			"Moderate calories, protein, carbs, fiber, and sugar.",
		);
		const balancedTargetPills = balancedPreview.locator(
			".goal-template-preview__goals .metadata-pill",
		);
		const balancedTargetCount = await balancedTargetPills.count();
		expect(balancedTargetCount).toBeGreaterThan(0);
		for (const targetText of await balancedTargetPills.allTextContents()) {
			expect(targetText).toMatch(/(?:=|≥|≤|–)/);
			expect(targetText).toMatch(/\b(?:kcal|g|mg|mcg|iu)\b/i);
		}
		await goalsSection.getByRole("button", { name: "Apply", exact: true }).click();
		await expect(balancedPreview).toBeHidden();
		const balancedGoals = await readRenderedMixGoals(goalsSection);
		expect(balancedGoals).toHaveLength(balancedTargetCount);
		for (const goal of balancedGoals) {
			expect(goal.name).not.toBe("");
			expect(goal.rule).toMatch(/^(?:exact|minimum|maximum|range)$/);
			expect(Number(goal.target)).toBeGreaterThanOrEqual(0);
			expect(goal.unit).toMatch(/^(?:kcal|g|mg|mcg|iu)$/i);
		}

		await goalsSection.getByText("Add nutrient", { exact: true }).click();
		const nutrientSearch = goalsSection.getByRole("searchbox", {
			name: "Find a nutrient",
		});
		await nutrientSearch.fill("potassium");
		await goalsSection
			.getByRole("button", { name: /Potassium.*MG/i })
			.first()
			.click();
		const potassiumGoalInput = goalsSection.getByRole("spinbutton", {
			name: /Goal value for Potassium.* in (?:MG|mg)/,
		});
		await potassiumGoalInput.fill("975");
		await expect(potassiumGoalInput).toHaveValue("975");
		await goalsSection.getByRole("button", { name: "Add goal" }).click();
		await expect(
			goalsSection.getByRole("slider", { name: /Set Potassium.* goal/ }),
		).toBeVisible();

		await selectGoalPreset(page, "Low Sugar");
		const keepOtherGoals = goalsSection.getByRole("switch", {
			name: "Keep goals not included in this preset",
		});
		await keepOtherGoals.check();
		await goalsSection.getByRole("button", { name: "Apply", exact: true }).click();
		await expect(
			goalsSection.getByRole("slider", { name: /Set Potassium.* goal/ }),
		).toBeVisible();

		await selectGoalPreset(page, "Low Sugar");
		await keepOtherGoals.uncheck();
		await goalsSection.getByRole("button", { name: "Apply", exact: true }).click();
		await expect(
			goalsSection.getByRole("slider", { name: /Set Potassium.* goal/ }),
		).toHaveCount(0);
		const replacementGoals = await readRenderedMixGoals(goalsSection);

		await page.reload();
		await waitForAppReady(page);
		let reopenedGoals = await openMixGoals(page);
		await expect(
			reopenedGoals.goalsSection.getByRole("combobox", {
				name: "Goal preset",
			}),
		).toContainText("Low Sugar");
		expect(await readRenderedMixGoals(reopenedGoals.goalsSection)).toEqual(
			replacementGoals,
		);

		await page.context().clearCookies();
		await page.goto("/auth?next=/mix");
		const qaAccount = getLocalQaAccountForWorker(testInfo.parallelIndex);
		await page.getByLabel("Email").fill(qaAccount.email);
		await page.getByLabel("Password", { exact: true }).fill(qaAccount.password);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await expect(page).toHaveURL(/\/mix$/);
		await waitForAppReady(page);
		reopenedGoals = await openMixGoals(page);
		await expect(
			reopenedGoals.goalsSection.getByRole("combobox", {
				name: "Goal preset",
			}),
		).toContainText("Low Sugar");
		expect(await readRenderedMixGoals(reopenedGoals.goalsSection)).toEqual(
			replacementGoals,
		);

		const persistedGoalConfiguration =
			await captureLocalQaMixGoalConfiguration(testInfo.parallelIndex);
		expect(persistedGoalConfiguration.goalTemplateCustomized).toBe(false);
		expect(persistedGoalConfiguration.sourceGoalTemplateVersionId).not.toBeNull();
		expect(
			persistedGoalConfiguration.goals.some(
				(goal) => goal.nutrient_id === 1092,
			),
		).toBe(false);
	} finally {
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
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
	await input.blur();
	await input.fill(originalValue);
	await input.blur();
	await expect(slider).toHaveValue(originalValue);
	await expect
		.poll(async () => {
			const configuration = await captureLocalQaMixGoalConfiguration(
				testInfo.parallelIndex,
			);
			return configuration.goals.find(
				(goal) => goal.nutrient_id === 1008,
			)?.target_amount;
		})
		.toBe(Number(originalValue));
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

test("explicit nutrient goals preserve zero, units, independent rules, and synchronized controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this durable goal mutation.",
	);

	const originalGoalConfiguration =
		await captureLocalQaMixGoalConfiguration(testInfo.parallelIndex);
	try {
		await page.goto("/mix");
		await waitForAppReady(page);
		const { goalsSection } = await openMixGoals(page);
		await goalsSection.getByText("Add nutrient", { exact: true }).click();
		await expect(goalsSection.getByText(/\d+ nutrients$/)).toBeVisible();
		const search = goalsSection.getByRole("searchbox", {
			name: "Find a nutrient",
		});

		await addExplicitNutrientGoal({
			goalsSection,
			search,
			searchTerm: "vitamin b12",
			nutrientLabel: "Vitamin B12",
			unit: "mcg",
			targetAmount: "2.4",
		});
		await addExplicitNutrientGoal({
			goalsSection,
			search,
			searchTerm: "magnesium",
			nutrientLabel: "Magnesium",
			unit: "mg",
			targetAmount: "125",
		});
		await addExplicitNutrientGoal({
			goalsSection,
			search,
			searchTerm: "added sugars",
			nutrientLabel: "Added Sugars",
			unit: "g",
			targetAmount: "0",
		});

		await selectGoalRule(goalsSection, "Vitamin B12", "At least");
		await selectGoalRule(goalsSection, "Added Sugars", "At most");

		const vitaminB12Input = goalsSection.getByRole("spinbutton", {
			name: "Goal value for Vitamin B12 in mcg",
		});
		const vitaminB12Slider = goalsSection.getByRole("slider", {
			name: "Set Vitamin B12 goal",
		});
		const magnesiumInput = goalsSection.getByRole("spinbutton", {
			name: "Goal value for Magnesium in mg",
		});
		const magnesiumSlider = goalsSection.getByRole("slider", {
			name: "Set Magnesium goal",
		});
		const addedSugarsInput = goalsSection.getByRole("spinbutton", {
			name: "Goal value for Added Sugars in g",
		});
		const addedSugarsSlider = goalsSection.getByRole("slider", {
			name: "Set Added Sugars goal",
		});

		await vitaminB12Slider.focus();
		await vitaminB12Slider.press("ArrowRight");
		await expect(vitaminB12Input).not.toHaveValue("2.4");
		await expect(magnesiumInput).toHaveValue("125");
		await expect(addedSugarsInput).toHaveValue("0");
		await vitaminB12Input.fill("2.4");
		await vitaminB12Input.blur();
		await expect(vitaminB12Slider).toHaveValue("2.4");

		await magnesiumSlider.focus();
		await magnesiumSlider.press("ArrowRight");
		await expect(magnesiumInput).toHaveValue("126");
		await expect(vitaminB12Input).toHaveValue("2.4");
		await expect(addedSugarsInput).toHaveValue("0");
		await magnesiumInput.fill("130");
		await magnesiumInput.blur();
		await expect(magnesiumSlider).toHaveValue("130");

		await addedSugarsSlider.focus();
		await addedSugarsSlider.press("ArrowRight");
		await expect(addedSugarsInput).toHaveValue("0.01");
		await expect(vitaminB12Input).toHaveValue("2.4");
		await expect(magnesiumInput).toHaveValue("130");
		await addedSugarsInput.fill("0");
		await addedSugarsInput.blur();
		await expect(addedSugarsSlider).toHaveValue("0");

		for (const [nutrientLabel, unit] of [
			["Vitamin B12", "mcg"],
			["Magnesium", "mg"],
			["Added Sugars", "g"],
		] as const) {
			await expect(
				goalsSection.locator(".goal-input").filter({ hasText: nutrientLabel }),
			).toContainText(unit);
		}

		await expect
			.poll(async () => {
				const configuration = await captureLocalQaMixGoalConfiguration(
					testInfo.parallelIndex,
				);
				return configuration.goals
					.filter((goal) => [1090, 1178, 1235].includes(goal.nutrient_id))
					.map((goal) => ({
						goalType: goal.goal_type,
						nutrientId: goal.nutrient_id,
						targetAmount: goal.target_amount,
					}))
					.sort((left, right) => left.nutrientId - right.nutrientId);
			})
			.toEqual([
				{ goalType: "exact", nutrientId: 1090, targetAmount: 130 },
				{ goalType: "minimum", nutrientId: 1178, targetAmount: 2.4 },
				{ goalType: "maximum", nutrientId: 1235, targetAmount: 0 },
			]);

		const expectedGoals = await readRenderedMixGoals(goalsSection);
		await page.reload();
		await waitForAppReady(page);
		const reopenedGoals = await openMixGoals(page);
		expect(await readRenderedMixGoals(reopenedGoals.goalsSection)).toEqual(
			expectedGoals,
		);
	} finally {
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});

test("Mix goal values, units, trace precision, and statuses stay synchronized across every summary", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this temporary Mix-state mutation.",
	);

	const originalGoalConfiguration =
		await captureLocalQaMixGoalConfiguration(testInfo.parallelIndex);
	try {
		await saveLocalQaMixState(testInfo.parallelIndex, {
			version: 1,
			selected: [1008, 1003, 1079, 1005, 1004],
			options: [
				{ id: 1008, label: "Calories" },
				{ id: 1003, label: "Protein" },
				{ id: 1079, label: "Dietary Fiber" },
				{ id: 1005, label: "Total Carbohydrates" },
				{ id: 1004, label: "Total Fat" },
			],
			selectedFoodIds: [9200001],
			servingGrams: { 9200001: 0.01 },
			servingQuantities: { 9200001: 0.01 },
			servingUnits: { 9200001: "g" },
		});

		await page.goto("/mix");
		await waitForAppReady(page);
		const goalsSection = await openMixSection(page, ".goals-panel");
		const shapeSection = await openMixSection(
			page,
			".nutrient-shape-panel",
		);
		const contributionsSection = await openMixSection(
			page,
			".contribution-breakdown",
		);
		const suggestionsSection = await openMixSection(
			page,
			".nutrient-adjustments",
		);
		const selectedSection = await openMixSection(
			page,
			".selected-ingredients-panel",
		);

		const expectedTraceValues = new Map<
			string,
			{ currentValue: string; status: "under" | "met" }
		>([
			["Calories", { currentValue: "0.002 kcal", status: "under" }],
			["Protein", { currentValue: "<0.001 g", status: "under" }],
			["Dietary Fiber", { currentValue: "<0.001 g", status: "under" }],
			["Total Fat", { currentValue: "<0.001 g", status: "met" }],
		]);
		for (const [
			nutrientLabel,
			{ currentValue: expectedCurrentValue, status: expectedStatus },
		] of expectedTraceValues) {
			const goalCard = goalsSection.locator(
				`.goal-input[data-nutrient-label="${nutrientLabel}"]`,
			);
			await expect(goalCard.locator(".goal-current strong")).toHaveText(
				expectedCurrentValue,
			);
			await expect(goalCard).toHaveAttribute("data-status", expectedStatus);

			const shapeStatus = shapeSection.locator(
				`[data-nutrient-label="${nutrientLabel}"]`,
			);
			await expect(shapeStatus).toHaveAttribute(
				"data-goal-status",
				expectedStatus,
			);
			await expect(shapeStatus.locator(".metadata-pill__value")).toContainText(
				expectedCurrentValue,
			);

			const contribution = contributionsSection.locator(
				`.contribution-card[data-nutrient-label="${nutrientLabel}"]`,
			);
			await expect(
				contribution.locator(".contribution-card__title span"),
			).toHaveText(expectedCurrentValue);
		}

		const impactValues = await suggestionsSection
			.locator(".nutrient-adjustment__impacts .metadata-pill")
			.allTextContents();
		expect(impactValues.length).toBeGreaterThan(0);
		for (const impactValue of impactValues) {
			expect(impactValue).toMatch(/[+−](?:<0\.001|\d[\d,.]*)\s(?:kcal|g|mg|mcg|iu)/i);
		}

		const readGoalStatus = async (nutrientLabel: string) => {
			const goalStatus = await goalsSection
				.locator(`.goal-input[data-nutrient-label="${nutrientLabel}"]`)
				.getAttribute("data-status");
			const shapeStatus = await shapeSection
				.locator(`[data-nutrient-label="${nutrientLabel}"]`)
				.getAttribute("data-goal-status");
			return { goalStatus, shapeStatus };
		};

		const inspectSaveReview = async (
			expectedCurrentValue: string,
			expectedStatus: "under" | "met" | "over",
		) => {
			await page.getByRole("button", { name: "Save mix" }).click();
			const dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
			await expect(dialog).toBeVisible();
			const caloriesRow = dialog.locator(
				'.save-goal-review__row[data-nutrient-label="Calories"]',
			);
			await expect(caloriesRow).toHaveAttribute(
				"data-goal-status",
				expectedStatus,
			);
			await expect(caloriesRow).toContainText(`Actual ${expectedCurrentValue}`);
			await expect(caloriesRow).toContainText("Goal =350 kcal");
			await dialog.getByRole("button", { name: "Cancel" }).click();
			await expect(dialog).toBeHidden();
		};

		expect(await readGoalStatus("Calories")).toEqual({
			goalStatus: "under",
			shapeStatus: "under",
		});
		await expect(page.locator('[data-warning-id="under-1008"]')).toHaveCount(1);
		await inspectSaveReview("0.002 kcal", "under");

		const spinachQuantity = selectedSection.getByRole("spinbutton", {
			name: "Quantity for Spinach, Raw",
		});
		await spinachQuantity.fill("1520");
		await expect(
			goalsSection.locator(
				'.goal-input[data-nutrient-label="Calories"] .goal-current strong',
			),
		).toHaveText("349.6 kcal");
		expect(await readGoalStatus("Calories")).toEqual({
			goalStatus: "met",
			shapeStatus: "met",
		});
		await expect(page.locator('[data-warning-id="under-1008"]')).toHaveCount(0);
		await expect(page.locator('[data-warning-id="over-1008"]')).toHaveCount(0);
		await inspectSaveReview("349.6 kcal", "met");

		await spinachQuantity.fill("3000");
		await expect(
			goalsSection.locator(
				'.goal-input[data-nutrient-label="Calories"] .goal-current strong',
			),
		).toHaveText("690 kcal");
		expect(await readGoalStatus("Calories")).toEqual({
			goalStatus: "over",
			shapeStatus: "over",
		});
		await expect(page.locator('[data-warning-id="over-1008"]')).toHaveCount(1);
		await inspectSaveReview("690 kcal", "over");
		await expect(spinachQuantity).toHaveValue("3000");
	} finally {
		if (!page.isClosed()) await page.close();
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
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
	await expect(nutrientShapeHandle).toBeEnabled();
	await nutrientShapeHandle.focus();
	await nutrientShapeHandle.press(returnKey);
	await expect(
		organizer.getByText(
			new RegExp(`moved to position ${initialPosition + 1} of`, "i"),
		),
	).toBeVisible();
	await expect.poll(readSectionOrder).toEqual(initialOrder);
	await expect(nutrientShapeHandle).toBeEnabled();
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
