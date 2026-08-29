import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";
import {
	captureAndClearLocalQaIngredientLists,
	captureLocalQaMixGoalConfiguration,
	deleteLocalQaSavedRecipesByNamePrefix,
	readLocalQaSavedRecipesByNamePrefix,
	restoreLocalQaIngredientLists,
	restoreLocalQaMixGoalConfiguration,
	saveLocalQaMixGoalConfiguration,
	saveLocalQaMixState,
} from "./support/localQaDatabase";
import { getLocalQaAccountForWorker } from "./support/localQaAccounts";
import type { Json } from "$lib/types/database.types";

const escapeRegularExpression = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
	await page
		.locator(".view-top")
		.first()
		.evaluate(async (element) => {
			await Promise.all(
				element
					.getAnimations({ subtree: true })
					.map((animation) => animation.finished.catch(() => undefined)),
			);
		});
	return section;
};

const openSavedRecipeCard = async (
	page: import("@playwright/test").Page,
	recipeName: string,
) => {
	const card = page
		.locator(".saved-recipe-card")
		.filter({ has: page.getByText(recipeName, { exact: true }) });
	await expect(card).toHaveCount(1);
	const details = card.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await expect(details).toHaveAttribute("open", "");
	await details.evaluate(async (element) => {
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});
	return card;
};

const persistenceNutrientOptions = [
	{ id: 1008, label: "Calories" },
	{ id: 1003, label: "Protein" },
];

const persistenceGoals = [
	{
		goal_type: "exact",
		importance_weight: 1,
		nutrient_id: 1008,
		sort_order: 1,
		target_amount: 400,
		tolerance_ratio: 0.05,
		upper_amount: null,
	},
	{
		goal_type: "minimum",
		importance_weight: 1,
		nutrient_id: 1003,
		sort_order: 2,
		target_amount: 31,
		tolerance_ratio: 0.05,
		upper_amount: null,
	},
];

const persistenceMixState = {
	version: 1,
	selected: persistenceNutrientOptions.map((nutrient) => nutrient.id),
	options: persistenceNutrientOptions,
	selectedFoodIds: [9200001, 9200002, 9200003, 9200004],
	servingGrams: {
		9200001: 30,
		9200002: 118,
		9200003: 170,
		9200004: 28,
	},
	servingQuantities: {
		9200001: 30,
		9200002: 118,
		9200003: 170,
		9200004: 28,
	},
	servingUnits: {
		9200001: "g",
		9200002: "g",
		9200003: "g",
		9200004: "g",
	},
};

const saveCurrentMixAsNew = async (
	page: import("@playwright/test").Page,
	recipeName: string,
) => {
	await page.getByRole("button", { name: "Save mix" }).click();
	await expect(page).toHaveURL(/\/mix\/save$/);
	const dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
	await dialog.getByLabel("Mix name").fill(recipeName);
	await dialog
		.getByRole("button", { name: "Save Recipe", exact: true })
		.click();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/mix$/);
};

const loadSavedRecipe = async (
	page: import("@playwright/test").Page,
	recipeName: string,
) => {
	await page.goto("/saved");
	await waitForAppReady(page);
	const savedCard = await openSavedRecipeCard(page, recipeName);
	await savedCard.getByRole("button", { name: `Load ${recipeName}` }).click();
	await expect(page).toHaveURL(/\/mix$/);
	await expect(page.locator(".mix-header")).toContainText(recipeName);
};

const openMixOptions = async (page: import("@playwright/test").Page) => {
	await page.getByRole("button", { name: "Open mix options" }).click();
	await expect(page).toHaveURL(/\/mix\/options$/);
	const dialog = page.getByRole("dialog", { name: "Mix options" });
	await expect(dialog).toBeVisible();
	return dialog;
};

const expectInnerListScrollPassesToMixPage = async ({
	page,
	list,
	itemSelector,
	loadMoreLabel,
}: {
	page: import("@playwright/test").Page;
	list: import("@playwright/test").Locator;
	itemSelector: string;
	loadMoreLabel: string;
}) => {
	const mixPage = page.locator(".mix-page");
	const itemNamesBefore = await list.locator(itemSelector).allTextContents();
	expect(itemNamesBefore.length).toBeGreaterThan(0);

	await list.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	await expect
		.poll(() =>
			list.evaluate(
				(element) =>
					Math.abs(
						element.scrollHeight - element.clientHeight - element.scrollTop,
					) <= 1,
			),
		)
		.toBe(true);
	await expect(list.getByRole("button", { name: loadMoreLabel })).toBeVisible();
	await expect(
		list.getByRole("button", { name: "Return to top" }),
	).toBeVisible();

	await list.evaluate((listElement) => {
		const mixPageElement = listElement.closest(".mix-page");
		if (!(mixPageElement instanceof HTMLElement)) {
			throw new Error("The Mix page scroll surface was unavailable.");
		}
		const mixPageBounds = mixPageElement.getBoundingClientRect();
		const listBounds = listElement.getBoundingClientRect();
		const maximumScroll =
			mixPageElement.scrollHeight - mixPageElement.clientHeight;
		const scrollWithRoomBelow = Math.max(0, maximumScroll - 500);
		const scrollThatPlacesListNearTop =
			mixPageElement.scrollTop + listBounds.top - mixPageBounds.top - 80;
		mixPageElement.scrollTop = Math.min(
			scrollWithRoomBelow,
			Math.max(0, scrollThatPlacesListNearTop),
		);
	});
	const listBounds = await list.boundingBox();
	if (!listBounds) {
		throw new Error(
			"The bounded Mix list did not have visible browser geometry.",
		);
	}
	await page.mouse.move(
		listBounds.x + listBounds.width / 2,
		listBounds.y + Math.min(listBounds.height / 2, 80),
	);
	const mainScrollBefore = await mixPage.evaluate(
		(element) => element.scrollTop,
	);
	const mainMaximumScroll = await mixPage.evaluate(
		(element) => element.scrollHeight - element.clientHeight,
	);
	expect(mainScrollBefore).toBeLessThan(mainMaximumScroll);
	await page.mouse.wheel(0, 500);
	await expect
		.poll(() => mixPage.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(mainScrollBefore);

	expect(await list.locator(itemSelector).allTextContents()).toEqual(
		itemNamesBefore,
	);
};

const readRenderedMixGoals = (
	goalsSection: import("@playwright/test").Locator,
) =>
	goalsSection.locator(".goal-input").evaluateAll((goalCards) =>
		goalCards.map((goalCard) => ({
			name: goalCard.querySelector(".goal-label")?.textContent?.trim() ?? "",
			rule:
				(
					goalCard.querySelector(
						".goal-input__type .select-field__native",
					) as HTMLSelectElement | null
				)?.value ?? "",
			target:
				(
					goalCard.querySelector(
						".goal-input__number",
					) as HTMLInputElement | null
				)?.value ?? "",
			unit: goalCard.querySelector(".goal-unit")?.textContent?.trim() ?? "",
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
	await goalsSection
		.getByRole("option", { name: ruleLabel, exact: true })
		.click();
};

test(
	"compact Mix header follows main-page scroll direction",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
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
	},
);

test("Mix disclosures expose animated open and closed state", async ({
	page,
}) => {
	await page.goto("/mix");
	await waitForAppReady(page);
	const { details, summary } = await openMixGoals(page);
	await expect(summary).toHaveAttribute("aria-expanded", "true");
	await expect(details).toHaveAttribute("data-surface", "panel");
	await expect(summary.locator(".disclosure-chevron")).toHaveCSS(
		"transform",
		"matrix(0, 1, -1, 0, 0, 0)",
	);
	await summary.focus();
	await summary.press("Enter");
	await expect(summary).toHaveAttribute("aria-expanded", "false");
	await details.evaluate((element) => {
		for (const animation of element.getAnimations({ subtree: true })) {
			animation.finish();
		}
	});
	await expect(details).not.toHaveAttribute("open", "");
	await expect(summary.locator(".disclosure-chevron")).toHaveCSS(
		"transform",
		"matrix(1, 0, 0, 1, 0, 0)",
	);
	await summary.press("Enter");
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
	expect(await nativePreset.locator("option:checked").textContent()).toContain(
		"Balanced",
	);
	await expect(
		page.getByText("Moderate calories, protein, carbs, fiber, and sugar."),
	).toBeVisible();
});

test("goal presets preserve explicit extras only when requested and survive a new session", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this durable goal mutation.",
	);

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
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
		await goalsSection
			.getByRole("button", { name: "Apply", exact: true })
			.click();
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
		await goalsSection
			.getByRole("button", { name: "Apply", exact: true })
			.click();
		await expect(
			goalsSection.getByRole("slider", { name: /Set Potassium.* goal/ }),
		).toBeVisible();

		await selectGoalPreset(page, "Low Sugar");
		await keepOtherGoals.uncheck();
		await goalsSection
			.getByRole("button", { name: "Apply", exact: true })
			.click();
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

		const qaAccount = getLocalQaAccountForWorker(testInfo.parallelIndex);
		await signInLocalQaAccount({
			page,
			email: qaAccount.email,
			nextPath: "/mix",
		});
		reopenedGoals = await openMixGoals(page);
		await expect(
			reopenedGoals.goalsSection.getByRole("combobox", {
				name: "Goal preset",
			}),
		).toContainText("Low Sugar");
		expect(await readRenderedMixGoals(reopenedGoals.goalsSection)).toEqual(
			replacementGoals,
		);

		const persistedGoalConfiguration = await captureLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
		);
		expect(persistedGoalConfiguration.goalTemplateCustomized).toBe(false);
		expect(
			persistedGoalConfiguration.sourceGoalTemplateVersionId,
		).not.toBeNull();
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

test("goal sliders and number inputs stay synchronized", async ({
	page,
}, testInfo) => {
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

	const proteinInput = page.getByRole("spinbutton", {
		name: "Goal value for Protein in g",
	});
	const originalProteinValue = await proteinInput.inputValue();
	await proteinInput.click();
	await page.keyboard.type("31");
	await expect(proteinInput).toHaveValue("31");
	await proteinInput.fill(originalProteinValue);
	await proteinInput.blur();
	await expect
		.poll(async () => {
			const configuration = await captureLocalQaMixGoalConfiguration(
				testInfo.parallelIndex,
			);
			return configuration.goals.find((goal) => goal.nutrient_id === 1008)
				?.target_amount;
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
	await summary.click();
	await expect(details).not.toHaveAttribute("open", "");
	await page.reload();
	await waitForAppReady(page);
	const persistedWarningsSection = page.locator(".mix-warnings");
	const persistedDetails = persistedWarningsSection.locator(":scope > details");
	const persistedSummary = persistedDetails.locator(":scope > summary");
	await expect(persistedDetails).not.toHaveAttribute("open", "");
	await expect(persistedWarningsSection).toHaveAttribute(
		"data-attention-tone",
		/warning|danger/,
	);
	await persistedSummary.click();
	await expect(persistedDetails).toHaveAttribute("open", "");
	if (!initiallyOpen) await persistedSummary.click();
});

test("Mix warning severity follows under-target and over-target goal states", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this temporary goal and Mix state.",
	);

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
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
		const { goalsSection } = await openMixGoals(page);
		await selectGoalRule(goalsSection, "Calories", "At least");
		const caloriesGoal = goalsSection.getByRole("spinbutton", {
			name: "Goal value for Calories in kcal",
		});
		await caloriesGoal.fill("350");
		await caloriesGoal.blur();

		let warningsSection = page.locator(".mix-warnings");
		await expect(warningsSection).toHaveAttribute(
			"data-attention-tone",
			"warning",
		);
		await expect(
			warningsSection.locator('[data-warning-id="under-1008"]'),
		).toHaveCount(1);
		await expect(warningsSection.locator('[role="status"]')).not.toContainText(
			"urgent",
		);

		await selectGoalRule(goalsSection, "Calories", "At most");
		await caloriesGoal.fill("0");
		await caloriesGoal.blur();

		warningsSection = page.locator(".mix-warnings");
		await expect(warningsSection).toHaveAttribute(
			"data-attention-tone",
			"danger",
		);
		await expect(
			warningsSection.locator('[data-warning-id="over-1008"]'),
		).toHaveCount(1);
		await expect(warningsSection.locator('[role="status"]')).toContainText(
			"urgent",
		);
	} finally {
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});

test("Mix preference warnings preserve evidence and clear independently", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The dedicated preference persona is mutated by one deterministic browser.",
	);

	await signInLocalQaAccount({
		page,
		email: "qa-preferences@blendcalc.local",
		nextPath: "/mix",
	});
	const chooser = await openMixSection(page, ".ingredient-chooser");
	const search = chooser.getByRole("searchbox", { name: "Find ingredients" });
	const originalSelectionState = new Map<string, boolean>();
	const conflictCorpus = [
		{
			fdcId: 9200012,
			name: "Ground Beef, 85% Lean, Cooked",
			query: "ground beef",
			expectedExplanation: /vegan|meat|beef/i,
		},
		{
			fdcId: 9200013,
			name: "Shrimp, Cooked",
			query: "shrimp",
			expectedExplanation: /shellfish|vegan/i,
		},
		{
			fdcId: 1890854,
			name: "Creamy Peanut Butter, Peanut Butter",
			query: "creamy peanut butter",
			expectedExplanation: /peanut/i,
		},
		{
			fdcId: 9100003,
			name: "Gochu Jang Hot & Sweet Chili Sauce",
			query: "gochu jang",
			expectedExplanation: /gluten|wheat/i,
		},
		{
			fdcId: 9200003,
			name: "Greek Yogurt, Plain",
			query: "greek yogurt",
			expectedExplanation: /milk|dairy|vegan/i,
		},
	] as const;
	const negativeControl = {
		fdcId: 9200002,
		name: "Banana, Raw",
		query: "banana",
	} as const;
	const completeCorpus = [...conflictCorpus, negativeControl];

	const getSelectionAction = async (name: string, query: string) => {
		await search.fill(query);
		const action = chooser.getByRole("button", {
			name: new RegExp(
				`^(?:Add|Remove) ${escapeRegularExpression(name)} (?:to|from) this mix`,
			),
		});
		await expect(action).toHaveCount(1);
		return action;
	};

	try {
		for (const food of completeCorpus) {
			const action = await getSelectionAction(food.name, food.query);
			const selected = (await action.getAttribute("aria-pressed")) === "true";
			originalSelectionState.set(food.name, selected);
			if (selected) {
				await action.click();
				await expect(action).toHaveAttribute("aria-pressed", "false");
			}
		}

		const retainedWarningSelectors: string[] = [];
		for (const food of conflictCorpus) {
			const action = await getSelectionAction(food.name, food.query);
			await action.click();
			await expect(action).toHaveAttribute("aria-pressed", "true");

			const warningsSection = await openMixSection(page, ".mix-warnings");
			const foodWarnings = warningsSection.locator(
				`[data-warning-id^="food-preference-${food.fdcId}-"]`,
			);
			await expect.poll(() => foodWarnings.count()).toBeGreaterThan(0);
			const firstWarning = foodWarnings
				.filter({ hasText: food.expectedExplanation })
				.first();
			await expect(firstWarning).toBeVisible();
			const warningId = await firstWarning.getAttribute("data-warning-id");
			expect(warningId).not.toBeNull();
			retainedWarningSelectors.push(`[data-warning-id="${warningId}"]`);

			await firstWarning.getByRole("button", { name: "Why?" }).click();
			await expect(page).toHaveURL(
				new RegExp(`/mix/warnings/${escapeRegularExpression(warningId!)}$`),
			);
			const explanation = page.getByRole("dialog", { name: food.name });
			await expect(explanation).toBeVisible();
			await expect(explanation).toContainText(food.expectedExplanation);
			await explanation
				.getByRole("button", { name: `Close ${food.name}` })
				.click();
			await expect(page).toHaveURL(/\/mix$/);

			for (const selector of retainedWarningSelectors) {
				await expect(page.locator(selector)).toHaveCount(1);
			}
		}

		const bananaAction = await getSelectionAction(
			negativeControl.name,
			negativeControl.query,
		);
		await bananaAction.click();
		await expect(bananaAction).toHaveAttribute("aria-pressed", "true");
		await expect(
			page.locator(
				`[data-warning-id^="food-preference-${negativeControl.fdcId}-"]`,
			),
		).toHaveCount(0);
		for (const selector of retainedWarningSelectors) {
			await expect(page.locator(selector)).toHaveCount(1);
		}

		for (const [index, food] of conflictCorpus.entries()) {
			const action = await getSelectionAction(food.name, food.query);
			await action.click();
			await expect(action).toHaveAttribute("aria-pressed", "false");
			await expect(
				page.locator(`[data-warning-id^="food-preference-${food.fdcId}-"]`),
			).toHaveCount(0);
			for (const selector of retainedWarningSelectors.slice(index + 1)) {
				await expect(page.locator(selector)).toHaveCount(1);
			}
		}
	} finally {
		for (const food of completeCorpus) {
			const originalSelected = originalSelectionState.get(food.name);
			if (originalSelected === undefined || page.isClosed()) continue;
			const action = await getSelectionAction(food.name, food.query);
			const selected = (await action.getAttribute("aria-pressed")) === "true";
			if (selected !== originalSelected) await action.click();
		}
	}
});

test("an empty Mix leads with one open Add ingredients path", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"This authoritative empty-state workflow temporarily clears one local QA account; the deterministic layout contract needs one browser owner rather than concurrent database mutation.",
	);
	const originalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
	const originalIngredientLists = await captureAndClearLocalQaIngredientLists(
		testInfo.parallelIndex,
	);
	try {
		const originalMixState =
			typeof originalConfiguration.mixState === "object" &&
			originalConfiguration.mixState !== null &&
			!Array.isArray(originalConfiguration.mixState)
				? (originalConfiguration.mixState as Record<string, Json | undefined>)
				: {};
		await saveLocalQaMixState(testInfo.parallelIndex, {
			...originalMixState,
			selectedFoodIds: [],
			servingGrams: {},
			servingQuantities: {},
			servingUnits: {},
		});
		await page.goto("/mix");
		await waitForAppReady(page);

		const firstBuilderSection = page
			.locator(".mix-builder > .mix-panel-section")
			.first();
		await expect(firstBuilderSection).toHaveAttribute(
			"aria-label",
			"Add ingredients",
		);
		await expect(
			firstBuilderSection.locator(":scope > details"),
		).toHaveAttribute("open", "");
		await expect(page.getByText("No ingredients selected")).toHaveCount(0);
		const ingredientsLink = firstBuilderSection.getByRole("link", {
			name: "Go to Ingredients",
		});
		await expect(ingredientsLink).toHaveAttribute(
			"href",
			"/ingredients/fridge",
		);
		await ingredientsLink.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	} finally {
		await Promise.all([
			restoreLocalQaMixGoalConfiguration(
				testInfo.parallelIndex,
				originalConfiguration,
			),
			restoreLocalQaIngredientLists(
				testInfo.parallelIndex,
				originalIngredientLists,
			),
		]);
	}
});

test("bounded Mix ingredient lists hand continued scrolling to the main page", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name.startsWith("mobile-"),
		"Playwright's emulated phone projects cannot prove native touch scroll chaining; physical iOS Safari and Android Chrome own this gesture.",
	);
	await page.goto("/mix");
	await waitForAppReady(page);

	const selectedSection = await openMixSection(
		page,
		".selected-ingredients-panel",
	);
	await expectInnerListScrollPassesToMixPage({
		page,
		list: selectedSection.locator(".selected-ingredient-cards"),
		itemSelector: ".mix-ingredient-amount-card",
		loadMoreLabel: "Load more selected ingredients",
	});

	const chooser = await openMixSection(page, ".ingredient-chooser");
	await expectInnerListScrollPassesToMixPage({
		page,
		list: chooser.locator(".ingredient-chooser__list"),
		itemSelector: ".mix-ingredient-option",
		loadMoreLabel: "Load more ingredients",
	});
});

test("selected ingredients progressively load and can be filtered", async ({
	page,
}) => {
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

	const chooser = await openMixSection(page, ".ingredient-chooser");
	const fridgeTab = chooser.getByRole("tab", { name: /Fridge/ });
	const shoppingTab = chooser.getByRole("tab", { name: /Shopping List/ });
	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
	await shoppingTab.click();
	await expect(shoppingTab).toHaveAttribute("aria-selected", "true");
	await shoppingTab.focus();
	await shoppingTab.press("ArrowLeft");
	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
});

test("Mix ingredient chooser preserves selection across search, sorting, pagination, and every card hit area", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"A single deterministic browser owns this temporary Mix-state mutation.",
	);

	await page.goto("/mix");
	await waitForAppReady(page);
	const chooser = page.locator(".ingredient-chooser");
	const chooserDetails = chooser.locator(":scope > details");
	if ((await chooserDetails.getAttribute("open")) === null) {
		await chooserDetails.locator(":scope > summary").click();
	}
	const selectedSection = page.locator(".selected-ingredients-panel");
	const selectedDetails = selectedSection.locator(":scope > details");
	if ((await selectedDetails.getAttribute("open")) === null) {
		await selectedDetails.locator(":scope > summary").click();
	}

	const chooserSearch = chooser.getByRole("searchbox", {
		name: "Find ingredients",
	});
	const selectedSearch = selectedSection.getByRole("searchbox", {
		name: "Find selected ingredients",
	});
	const selectionCorpus = [
		{ query: "spinach", name: "Spinach, Raw" },
		{ query: "beef", name: "Beef" },
		{ query: "strawberry", name: "Strawberry Jelly, Strawberry" },
	];

	for (const { query, name } of selectionCorpus) {
		await chooserSearch.fill(query);
		const selectionAction = chooser.getByRole("button", {
			name: new RegExp(
				`^(?:Add|Remove) ${escapeRegularExpression(name)} (?:to|from) this mix`,
			),
		});
		const card = selectionAction.locator("..");
		await expect(card).toHaveCount(1);
		const originalSelected =
			(await selectionAction.getAttribute("aria-pressed")) === "true";
		const expectSynchronizedSelection = async (selected: boolean) => {
			await expect(selectionAction).toHaveAttribute(
				"aria-pressed",
				String(selected),
			);
			await selectedSearch.fill(name);
			await expect(
				selectedSection.getByRole("spinbutton", {
					name: `Quantity for ${name}`,
				}),
			).toHaveCount(selected ? 1 : 0);
		};

		await card.scrollIntoViewIfNeeded();
		const nameBounds = await card
			.getByText(name, { exact: true })
			.boundingBox();
		expect(nameBounds).not.toBeNull();
		await page.mouse.click(
			nameBounds!.x + nameBounds!.width / 2,
			nameBounds!.y + nameBounds!.height / 2,
		);
		await expectSynchronizedSelection(!originalSelected);

		await card.scrollIntoViewIfNeeded();
		const cardBounds = await card.boundingBox();
		expect(cardBounds).not.toBeNull();
		await page.mouse.click(
			cardBounds!.x + cardBounds!.width * 0.72,
			cardBounds!.y + cardBounds!.height * 0.82,
		);
		await expectSynchronizedSelection(originalSelected);

		await card.scrollIntoViewIfNeeded();
		const selectionIndicatorBounds = await card
			.locator(".mix-ingredient-option__select-status")
			.boundingBox();
		expect(selectionIndicatorBounds).not.toBeNull();
		await page.mouse.click(
			selectionIndicatorBounds!.x + selectionIndicatorBounds!.width / 2,
			selectionIndicatorBounds!.y + selectionIndicatorBounds!.height / 2,
		);
		await expectSynchronizedSelection(!originalSelected);

		await selectionAction.scrollIntoViewIfNeeded();
		await selectionAction.click();
		await expectSynchronizedSelection(originalSelected);
	}
	await selectedSearch.fill("");
	await chooserSearch.fill("");

	const originalSelectedCount = Number.parseInt(
		(await chooser.locator(".result-count").textContent())?.match(
			/(\d+) selected/,
		)?.[1] ?? "-1",
		10,
	);
	expect(originalSelectedCount).toBeGreaterThan(0);
	await chooser
		.getByRole("button", { name: "Filter and sort ingredients" })
		.click();
	await expect(page).toHaveURL(/\/mix\/ingredients\/filters$/);
	let filterSheet = page.getByRole("dialog", {
		name: "Filter and sort ingredients",
	});
	await expect(
		filterSheet.getByRole("button", { name: "Warnings" }),
	).toBeVisible();
	await expect(
		filterSheet.getByRole("button", { name: "Active recalls" }),
	).toBeVisible();
	await filterSheet.getByRole("button", { name: "Selected only" }).click();
	await filterSheet.getByRole("button", { name: "A → Z" }).click();
	await filterSheet.getByRole("button", { name: "Apply" }).click();
	await expect(page).toHaveURL(/\/mix$/);
	const visibleSelectedCardCount = await chooser
		.locator(".mix-ingredient-option")
		.count();
	expect(visibleSelectedCardCount).toBeGreaterThan(0);
	expect(visibleSelectedCardCount).toBeLessThanOrEqual(originalSelectedCount);
	for (const selectedCardAction of await chooser
		.locator(".mix-ingredient-option__select")
		.all()) {
		await expect(selectedCardAction).toHaveAttribute("aria-pressed", "true");
	}
	await expect(chooser.locator(".result-count")).toContainText(
		`${originalSelectedCount} selected`,
	);

	await chooser
		.getByRole("button", { name: "Filter and sort ingredients" })
		.click();
	filterSheet = page.getByRole("dialog", {
		name: "Filter and sort ingredients",
	});
	await filterSheet.getByRole("button", { name: "All ingredients" }).click();
	await filterSheet.getByRole("button", { name: "A → Z" }).click();
	await filterSheet.getByRole("button", { name: "Apply" }).click();
	await expect(page).toHaveURL(/\/mix$/);

	const chooserCards = chooser.locator(".mix-ingredient-option");
	const firstPageNames = await chooserCards
		.locator(".mix-ingredient-option__copy strong")
		.allTextContents();
	expect(firstPageNames.length).toBeGreaterThan(1);
	expect(firstPageNames).toEqual(
		[...firstPageNames].sort((first, second) => first.localeCompare(second)),
	);
	const firstPageCardIds = await chooserCards.evaluateAll((cards) =>
		cards.map((card) =>
			card.querySelector("button")?.getAttribute("aria-label"),
		),
	);
	const loadMore = chooser.getByRole("button", {
		name: "Load more ingredients",
	});
	await expect(loadMore).toBeVisible();
	await loadMore.click();
	await expect
		.poll(() => chooserCards.count())
		.toBeGreaterThan(firstPageNames.length);
	await expect
		.poll(() =>
			chooserCards.evaluateAll(
				(cards, originalCardCount) =>
					cards
						.slice(0, originalCardCount)
						.map((card) =>
							card.querySelector("button")?.getAttribute("aria-label"),
						),
				firstPageCardIds.length,
			),
		)
		.toEqual(firstPageCardIds);
	await expect(chooser.locator(".result-count")).toContainText(
		`${originalSelectedCount} selected`,
	);

	await chooser.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(
		chooser.getByRole("tab", { name: /Shopping List/ }),
	).toHaveAttribute("aria-selected", "true");
	await chooserSearch.fill("broccoli");
	const shoppingSelection = chooser.getByRole("button", {
		name: /^(?:Add|Remove) Broccoli (?:to|from) this mix/,
	});
	const shoppingCard = shoppingSelection.locator("..");
	await expect(shoppingCard).toHaveCount(1);
	const shoppingOriginallySelected =
		(await shoppingSelection.getAttribute("aria-pressed")) === "true";
	const shoppingNameBounds = await shoppingCard
		.getByText("Broccoli", { exact: true })
		.boundingBox();
	expect(shoppingNameBounds).not.toBeNull();
	await page.mouse.click(
		shoppingNameBounds!.x + shoppingNameBounds!.width / 2,
		shoppingNameBounds!.y + shoppingNameBounds!.height / 2,
	);
	await expect(shoppingSelection).toHaveAttribute(
		"aria-pressed",
		String(!shoppingOriginallySelected),
	);
	await shoppingSelection.click();
	await expect(shoppingSelection).toHaveAttribute(
		"aria-pressed",
		String(shoppingOriginallySelected),
	);
});

test(
	"compact Mix chooser cards keep long names clear of the selection control",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			!testInfo.project.name.startsWith("mobile-"),
			"Compact geometry is owned by phone-layout projects.",
		);

		await page.goto("/mix");
		await waitForAppReady(page);
		const chooser = page.locator(".ingredient-chooser");
		const details = chooser.locator(":scope > details");
		if ((await details.getAttribute("open")) === null) {
			await details.locator(":scope > summary").click();
		}
		await chooser
			.getByRole("searchbox", { name: "Find ingredients" })
			.fill("strawberry");
		const card = chooser
			.getByRole("button", {
				name: /^(?:Add|Remove) Strawberry Jelly, Strawberry (?:to|from) this mix/,
			})
			.locator("..");
		await expect(card).toHaveCount(1);
		const [copyBounds, indicatorBounds] = await Promise.all([
			card.locator(".mix-ingredient-option__copy").boundingBox(),
			card.locator(".mix-ingredient-option__select-status").boundingBox(),
		]);
		expect(copyBounds).not.toBeNull();
		expect(indicatorBounds).not.toBeNull();
		expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(
			indicatorBounds!.x,
		);
		await expect(card.getByText("Custom", { exact: true })).toHaveCount(0);
		await expect(card.locator(".ingredient-category-badge")).toHaveCount(0);
	},
);

test("selected ingredient amount typing and controls change once and restore the original value", async ({
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
	await selectedSection
		.getByRole("searchbox", { name: "Find selected ingredients" })
		.fill("");
	const representativeQuantityInputs = selectedSection.locator(
		".mix-ingredient-amount-card__quantity-input",
	);
	expect(await representativeQuantityInputs.count()).toBeGreaterThanOrEqual(2);
	for (const [index, replacementValue] of ["37.5", "42.25"].entries()) {
		const representativeInput = representativeQuantityInputs.nth(index);
		const representativeOriginalValue = await representativeInput.inputValue();
		await representativeInput.click();
		await page.keyboard.type(replacementValue);
		await expect(representativeInput).toHaveValue(replacementValue);
		await representativeInput.fill(representativeOriginalValue);
		await representativeInput.blur();
	}
	await selectedSection
		.getByRole("searchbox", { name: "Find selected ingredients" })
		.fill("Mango");
	await selectedSection
		.getByRole("button", { name: "Use more Mango, Raw" })
		.click();
	await expect(quantity).not.toHaveValue(originalValue);
	await selectedSection
		.getByRole("button", { name: "Use less Mango, Raw" })
		.click();
	await expect(quantity).toHaveValue(originalValue);
});

test("safe Mix suggestions apply practical increases and reductions once and undo immediately", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this temporary Mix-state mutation.",
	);

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
	const nutrientOptions = [
		{ id: 1008, label: "Calories" },
		{ id: 1003, label: "Protein" },
		{ id: 1079, label: "Dietary Fiber" },
		{ id: 2000, label: "Total Sugars" },
		{ id: 1004, label: "Total Fat" },
	];
	const makeExactGoals = (targets: Record<number, number>) =>
		nutrientOptions.map((nutrient, index) => ({
			goal_type: "exact",
			importance_weight: 1,
			nutrient_id: nutrient.id,
			sort_order: index + 1,
			target_amount: targets[nutrient.id] ?? 0,
			tolerance_ratio: 0.05,
			upper_amount: null,
		}));
	const saveSpinachScenario = async (
		grams: number,
		targets: Record<number, number>,
	) => {
		await saveLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			makeExactGoals(targets),
		);
		await saveLocalQaMixState(testInfo.parallelIndex, {
			version: 1,
			selected: nutrientOptions.map((nutrient) => nutrient.id),
			options: nutrientOptions,
			selectedFoodIds: [9200001],
			servingGrams: { 9200001: grams },
			servingQuantities: { 9200001: grams },
			servingUnits: { 9200001: "g" },
		});
	};
	const readSpinachQuantity = async () => {
		const selectedSection = await openMixSection(
			page,
			".selected-ingredients-panel",
		);
		return selectedSection.getByRole("spinbutton", {
			name: "Quantity for Spinach, Raw",
		});
	};
	const applySuggestionAndUndo = async ({
		direction,
		startingGrams,
		expectedGrams,
	}: {
		direction: "Increase" | "Reduce";
		startingGrams: number;
		expectedGrams: number;
	}) => {
		await page.goto("/mix");
		await waitForAppReady(page);
		const suggestionsSection = await openMixSection(
			page,
			".nutrient-adjustments",
		);
		const suggestion = suggestionsSection
			.locator(".nutrient-adjustment")
			.filter({ hasText: "Spinach, Raw" });
		await expect(suggestion).toHaveCount(1);
		await expect(suggestion).toContainText(
			`${direction} to ${expectedGrams.toLocaleString("en-US", { maximumFractionDigits: 3 })} g`,
		);
		await expect(suggestion).toContainText(
			"Uses one reported serving: 1 cup (30 g)",
		);
		await expect(
			suggestion.locator(".nutrient-adjustment__impacts .metadata-pill"),
		).not.toHaveCount(0);

		const quantity = await readSpinachQuantity();
		await expect(quantity).toHaveValue(String(startingGrams));
		await suggestion.getByRole("button", { name: "Apply" }).click();
		await expect(quantity).toHaveValue(String(expectedGrams));
		await expect(
			suggestionsSection.getByText("Spinach, Raw updated."),
		).toBeVisible();
		await suggestionsSection.getByRole("button", { name: "Undo" }).click();
		await expect(quantity).toHaveValue(String(startingGrams));
		await expect(
			suggestionsSection.getByRole("button", { name: "Undo" }),
		).toHaveCount(0);
	};

	try {
		await saveSpinachScenario(0.01, {
			1008: 350,
			1003: 25,
			1079: 10,
			2000: 25,
			1004: 15,
		});
		await applySuggestionAndUndo({
			direction: "Increase",
			startingGrams: 0.01,
			expectedGrams: 30.01,
		});

		await page.goto("about:blank");
		await saveSpinachScenario(3000, {
			1008: 100,
			1003: 5,
			1079: 2,
			2000: 1,
			1004: 1,
		});
		await applySuggestionAndUndo({
			direction: "Reduce",
			startingGrams: 3000,
			expectedGrams: 2970,
		});
	} finally {
		if (!page.isClosed()) await page.close();
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});

test("Mix preserves exact grams across package, household, and weight-only serving controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this temporary Mix-state mutation.",
	);

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
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
			selectedFoodIds: [2032704, 9200002, 9200012],
			servingGrams: { 2032704: 125, 9200002: 118, 9200012: 113 },
			servingQuantities: { 2032704: 125, 9200002: 118, 9200012: 113 },
			servingUnits: { 2032704: "g", 9200002: "g", 9200012: "g" },
		});

		await page.goto("/mix");
		await waitForAppReady(page);
		const selectedSection = await openMixSection(
			page,
			".selected-ingredients-panel",
		);
		const pastaCard = selectedSection
			.locator(".mix-ingredient-amount-card")
			.filter({ hasText: "Roasted Onion & Garlic Pasta Sauce" });
		const bananaCard = selectedSection
			.locator(".mix-ingredient-amount-card")
			.filter({ hasText: "Banana, Raw" });
		const beefCard = selectedSection
			.locator(".mix-ingredient-amount-card")
			.filter({ hasText: "Ground Beef, 85% Lean, Cooked" });

		const pastaQuantity = pastaCard.getByRole("spinbutton", {
			name: "Quantity for Roasted Onion & Garlic Pasta Sauce",
		});
		const pastaMeasure = pastaCard.getByRole("combobox", {
			name: "Measure for Roasted Onion & Garlic Pasta Sauce",
		});
		await pastaMeasure.click();
		await page.getByRole("option", { name: "cup", exact: true }).click();
		await expect(pastaQuantity).toHaveValue("0.5");
		await expect(pastaCard).toContainText(/125\s*g equivalent/i);
		await pastaCard
			.getByRole("button", {
				name: "Show details for Roasted Onion & Garlic Pasta Sauce",
			})
			.click();
		await expect(pastaCard).toContainText(/Calculated from 0\.5 cup/i);
		await expect(pastaCard).toContainText(/1\/2 cup \(125 g\) = 125g/i);

		const bananaQuantity = bananaCard.getByRole("spinbutton", {
			name: "Quantity for Banana, Raw",
		});
		const bananaMeasure = bananaCard.getByRole("combobox", {
			name: "Measure for Banana, Raw",
		});
		await bananaMeasure.click();
		await page
			.getByRole("option", { name: "medium banana", exact: true })
			.click();
		await expect(bananaQuantity).toHaveValue("1");
		await expect(bananaCard).toContainText(/118\s*g equivalent/i);

		await bananaCard
			.getByRole("button", { name: "Use more Banana, Raw" })
			.click();
		await expect(bananaQuantity).toHaveValue("2");
		await expect(bananaCard).toContainText(/236\s*g equivalent/i);
		await bananaQuantity.fill("1.5");
		await expect(bananaCard).toContainText(/177\s*g equivalent/i);
		await bananaCard
			.getByRole("button", { name: "Use less Banana, Raw" })
			.click();
		await expect(bananaQuantity).toHaveValue("0.5");
		await expect(bananaCard).toContainText(/59\s*g equivalent/i);

		await bananaMeasure.click();
		await page.getByRole("option", { name: "g", exact: true }).click();
		await expect(bananaQuantity).toHaveValue("59");
		await expect(bananaCard.getByText(/g equivalent/i)).toHaveCount(0);

		const beefMeasure = beefCard.getByRole("combobox", {
			name: "Measure for Ground Beef, 85% Lean, Cooked",
		});
		await beefMeasure.click();
		for (const volumeUnit of ["cup", "tbsp", "tsp", "ml", "floz"]) {
			await expect(
				page.getByRole("option", { name: volumeUnit, exact: true }),
			).toHaveCount(0);
		}

		await expect
			.poll(async () => {
				const configuration = await captureLocalQaMixGoalConfiguration(
					testInfo.parallelIndex,
				);
				return configuration.mixState;
			})
			.toMatchObject({
				servingGrams: { 2032704: 125, 9200002: 59, 9200012: 113 },
				servingQuantities: { 2032704: 0.5, 9200002: 59, 9200012: 113 },
				servingUnits: { 2032704: "cup", 9200002: "g", 9200012: "g" },
			});
	} finally {
		if (!page.isClosed()) await page.close();
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});

test("explicit nutrient goals preserve zero, units, independent rules, and synchronized controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this durable goal mutation.",
	);

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
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

	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
	try {
		await saveLocalQaMixGoalConfiguration(testInfo.parallelIndex, [
			{
				goal_type: "exact",
				importance_weight: 1,
				nutrient_id: 1008,
				sort_order: 1,
				target_amount: 350,
				tolerance_ratio: 0.05,
				upper_amount: null,
			},
			{
				goal_type: "minimum",
				importance_weight: 1,
				nutrient_id: 1003,
				sort_order: 2,
				target_amount: 20,
				tolerance_ratio: 0.05,
				upper_amount: null,
			},
			{
				goal_type: "minimum",
				importance_weight: 1,
				nutrient_id: 1079,
				sort_order: 3,
				target_amount: 10,
				tolerance_ratio: 0.05,
				upper_amount: null,
			},
			{
				goal_type: "exact",
				importance_weight: 1,
				nutrient_id: 1005,
				sort_order: 4,
				target_amount: 60,
				tolerance_ratio: 0.05,
				upper_amount: null,
			},
			{
				goal_type: "maximum",
				importance_weight: 1,
				nutrient_id: 1004,
				sort_order: 5,
				target_amount: 20,
				tolerance_ratio: 0.05,
				upper_amount: null,
			},
		]);
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
		const shapeSection = await openMixSection(page, ".nutrient-shape-panel");
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
			expect(impactValue).toMatch(
				/[+−](?:<0\.001|\d[\d,.]*)\s(?:kcal|g|mg|mcg|iu)/i,
			);
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
		organizer
			.locator("[data-mix-section-id]")
			.evaluateAll((elements) =>
				elements.map((element) => element.getAttribute("data-mix-section-id")),
			);
	const initialOrder = await readSectionOrder();
	const initialPosition = initialOrder.indexOf("nutrient-shape");
	expect(initialPosition).toBeGreaterThanOrEqual(0);
	const movementKey =
		initialPosition === initialOrder.length - 1 ? "ArrowUp" : "ArrowDown";
	const returnKey = movementKey === "ArrowDown" ? "ArrowUp" : "ArrowDown";
	const movedPosition =
		initialPosition + (movementKey === "ArrowDown" ? 1 : -1);
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

test("the Mix save dialog accepts text and cancels without saving", async ({
	page,
}) => {
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

test("Mix recipes save once, reject duplicate names, and preserve overwrite and save-as-new snapshots", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this saved-recipe persistence lifecycle.",
	);

	const recipePrefix = "QA Goal Persistence Mix";
	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
	try {
		await deleteLocalQaSavedRecipesByNamePrefix(
			testInfo.parallelIndex,
			recipePrefix,
		);
		await saveLocalQaMixState(testInfo.parallelIndex, persistenceMixState);
		await saveLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			persistenceGoals,
		);

		await page.goto("/mix");
		await waitForAppReady(page);
		let selectedSection = await openMixSection(
			page,
			".selected-ingredients-panel",
		);
		const spinachQuantity = selectedSection.getByRole("spinbutton", {
			name: "Quantity for Spinach, Raw",
		});
		await spinachQuantity.fill("45");
		await expect(spinachQuantity).toHaveValue("45");

		let { goalsSection } = await openMixGoals(page);
		const proteinGoal = goalsSection.getByRole("spinbutton", {
			name: "Goal value for Protein in g",
		});
		await proteinGoal.fill("32");
		await proteinGoal.blur();
		await expect(
			page.getByText("Unsaved changes", { exact: true }),
		).toBeVisible();

		await page.getByRole("button", { name: "Save mix" }).click();
		await expect(page).toHaveURL(/\/mix\/save$/);
		let dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
		await expect(dialog.locator(".save-goal-review__row")).toHaveCount(2);
		await expect(
			dialog.locator('.save-goal-review__row[data-nutrient-label="Protein"]'),
		).toContainText("Goal ≥32 g");
		await dialog.getByLabel("Mix name").fill(recipePrefix);
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(page).toHaveURL(/\/mix$/);
		await expect
			.poll(
				async () =>
					(
						await readLocalQaSavedRecipesByNamePrefix(
							testInfo.parallelIndex,
							recipePrefix,
						)
					).length,
			)
			.toBe(0);

		await saveCurrentMixAsNew(page, recipePrefix);
		await expect(page.locator(".mix-header")).toContainText(recipePrefix);
		await expect(page.getByRole("button", { name: "Save mix" })).toBeDisabled();
		await expect(
			page.getByText("Unsaved changes", { exact: true }),
		).toHaveCount(0);
		await expect
			.poll(
				async () =>
					(
						await readLocalQaSavedRecipesByNamePrefix(
							testInfo.parallelIndex,
							recipePrefix,
						)
					).length,
			)
			.toBe(1);

		await page.reload();
		await waitForAppReady(page);
		await expect(page.locator(".mix-header")).toContainText(recipePrefix);
		await expect(page.getByRole("button", { name: "Save mix" })).toBeDisabled();
		selectedSection = await openMixSection(page, ".selected-ingredients-panel");
		await expect(
			selectedSection.getByRole("spinbutton", {
				name: "Quantity for Spinach, Raw",
			}),
		).toHaveValue("45");
		({ goalsSection } = await openMixGoals(page));
		await expect(
			goalsSection.getByRole("spinbutton", {
				name: "Goal value for Protein in g",
			}),
		).toHaveValue("32");

		await selectedSection
			.getByRole("spinbutton", { name: "Quantity for Spinach, Raw" })
			.fill("46");
		await page.getByRole("button", { name: "Save mix" }).click();
		dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
		await expect(dialog.getByLabel("Mix name")).toHaveValue(recipePrefix);
		await dialog.getByRole("button", { name: "Save as New" }).click();
		await expect(dialog.getByRole("alert")).toContainText(
			"You already have a saved recipe with this name.",
		);
		await expect
			.poll(
				async () =>
					(
						await readLocalQaSavedRecipesByNamePrefix(
							testInfo.parallelIndex,
							recipePrefix,
						)
					).length,
			)
			.toBe(1);
		await dialog.getByRole("button", { name: "Cancel" }).click();

		await page.goto("/saved");
		await waitForAppReady(page);
		let savedCard = await openSavedRecipeCard(page, recipePrefix);
		await savedCard
			.getByRole("button", { name: `Load ${recipePrefix}` })
			.click();
		await expect(page).toHaveURL(/\/mix$/);
		await expect(page.locator(".mix-header")).toContainText(recipePrefix);
		await expect(page.getByRole("button", { name: "Save mix" })).toBeDisabled();

		selectedSection = await openMixSection(page, ".selected-ingredients-panel");
		await selectedSection
			.getByRole("spinbutton", { name: "Quantity for Spinach, Raw" })
			.fill("52");
		await page.getByRole("button", { name: "Save mix" }).click();
		dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
		await dialog.getByRole("button", { name: "Overwrite Existing" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByRole("button", { name: "Save mix" })).toBeDisabled();

		await page.reload();
		await waitForAppReady(page);
		selectedSection = await openMixSection(page, ".selected-ingredients-panel");
		await expect(
			selectedSection.getByRole("spinbutton", {
				name: "Quantity for Spinach, Raw",
			}),
		).toHaveValue("52");

		const copiedRecipeName = `${recipePrefix} Copy`;
		await selectedSection
			.getByRole("spinbutton", { name: "Quantity for Spinach, Raw" })
			.fill("60");
		await page.getByRole("button", { name: "Save mix" }).click();
		dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
		await dialog.getByLabel("Mix name").fill(copiedRecipeName);
		await dialog.getByRole("button", { name: "Save as New" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.locator(".mix-header")).toContainText(copiedRecipeName);
		await expect
			.poll(async () =>
				(
					await readLocalQaSavedRecipesByNamePrefix(
						testInfo.parallelIndex,
						recipePrefix,
					)
				).map((recipe) => recipe.name),
			)
			.toEqual([recipePrefix, copiedRecipeName]);

		await page.reload();
		await waitForAppReady(page);
		selectedSection = await openMixSection(page, ".selected-ingredients-panel");
		await expect(
			selectedSection.getByRole("spinbutton", {
				name: "Quantity for Spinach, Raw",
			}),
		).toHaveValue("60");
		await page.goto("/saved");
		await waitForAppReady(page);
		savedCard = await openSavedRecipeCard(page, recipePrefix);
		await expect(savedCard).toBeVisible();
		await expect(
			await openSavedRecipeCard(page, copiedRecipeName),
		).toBeVisible();
	} finally {
		await deleteLocalQaSavedRecipesByNamePrefix(
			testInfo.parallelIndex,
			recipePrefix,
		);
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});

test("Mix reset actions cancel safely, preserve their intended state, detach saved identity, and survive reload", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated browser worker owns this Mix reset persistence lifecycle.",
	);

	const recipeName = "QA Reset Persistence Mix";
	const originalGoalConfiguration = await captureLocalQaMixGoalConfiguration(
		testInfo.parallelIndex,
	);
	const persistenceGoalSignature = JSON.stringify(persistenceGoals);
	const currentGoalSignature = async () =>
		JSON.stringify(
			(await captureLocalQaMixGoalConfiguration(testInfo.parallelIndex)).goals,
		);
	const expectSelectedIngredientCount = async (count: number) => {
		const selectedSection = await openMixSection(
			page,
			".selected-ingredients-panel",
		);
		await expect(
			selectedSection.getByRole("spinbutton", { name: /^Quantity for / }),
		).toHaveCount(count);
	};
	const cancelReset = async (
		actionLabel: string,
		dialogName: string,
		expectedPath: RegExp,
	) => {
		const options = await openMixOptions(page);
		await options
			.getByRole("button", { name: actionLabel, exact: true })
			.click();
		await expect(page).toHaveURL(expectedPath);
		const confirmation = page.getByRole("alertdialog", { name: dialogName });
		await expect(confirmation).toBeVisible();
		await confirmation
			.getByRole("button", { name: "Cancel", exact: true })
			.click();
		await expect(page).toHaveURL(/\/mix$/);
	};
	const confirmReset = async (
		actionLabel: string,
		dialogName: string,
		confirmLabel: string,
	) => {
		const options = await openMixOptions(page);
		await options
			.getByRole("button", { name: actionLabel, exact: true })
			.click();
		const confirmation = page.getByRole("alertdialog", { name: dialogName });
		await confirmation
			.getByRole("button", { name: confirmLabel, exact: true })
			.click();
		await expect(page).toHaveURL(/\/mix$/);
	};

	try {
		await deleteLocalQaSavedRecipesByNamePrefix(
			testInfo.parallelIndex,
			recipeName,
		);
		await saveLocalQaMixState(testInfo.parallelIndex, persistenceMixState);
		await saveLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			persistenceGoals,
		);
		await page.goto("/mix");
		await waitForAppReady(page);
		await saveCurrentMixAsNew(page, recipeName);

		const options = await openMixOptions(page);
		await options
			.getByRole("button", { name: "Reset goals to default", exact: true })
			.click();
		await expect(page).toHaveURL(/\/mix\/reset-goals$/);
		await expect(
			page.getByRole("alertdialog", { name: "Reset nutrition goals?" }),
		).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(/\/mix\/options$/);
		await expect(
			page.getByRole("dialog", { name: "Mix options" }),
		).toBeVisible();
		await page.goForward();
		await expect(page).toHaveURL(/\/mix\/reset-goals$/);
		await page.reload();
		await waitForAppReady(page);
		const resetGoalsConfirmation = page.getByRole("alertdialog", {
			name: "Reset nutrition goals?",
		});
		await expect(resetGoalsConfirmation).toBeVisible();
		await resetGoalsConfirmation
			.getByRole("button", { name: "Cancel", exact: true })
			.click();
		await expect(page.locator(".mix-header")).toContainText(recipeName);
		await expect.poll(currentGoalSignature).toBe(persistenceGoalSignature);
		await expectSelectedIngredientCount(4);

		await cancelReset(
			"Clear all ingredients",
			"Clear selected ingredients?",
			/\/mix\/clear-ingredients$/,
		);
		await cancelReset(
			"Reset everything",
			"Reset the entire mix?",
			/\/mix\/reset-all$/,
		);
		await expect(page.locator(".mix-header")).toContainText(recipeName);
		await expectSelectedIngredientCount(4);

		await confirmReset(
			"Reset goals to default",
			"Reset nutrition goals?",
			"Reset goals",
		);
		await expect(page.locator(".mix-header")).not.toContainText(recipeName);
		await expectSelectedIngredientCount(4);
		await expect.poll(currentGoalSignature).not.toBe(persistenceGoalSignature);
		await page.reload();
		await waitForAppReady(page);
		await expect(page.locator(".mix-header")).not.toContainText(recipeName);
		await expectSelectedIngredientCount(4);

		await loadSavedRecipe(page, recipeName);
		await confirmReset(
			"Clear all ingredients",
			"Clear selected ingredients?",
			"Clear ingredients",
		);
		await expect(page.locator(".mix-header")).not.toContainText(recipeName);
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).toBe(persistenceGoalSignature);
		await page.reload();
		await waitForAppReady(page);
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).toBe(persistenceGoalSignature);

		await loadSavedRecipe(page, recipeName);
		await confirmReset(
			"Reset everything",
			"Reset the entire mix?",
			"Reset all",
		);
		await expect(page.locator(".mix-header")).not.toContainText(recipeName);
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).not.toBe(persistenceGoalSignature);
		const resetGoalSignature = await currentGoalSignature();
		await page.goBack();
		await expect(page).toHaveURL(/\/mix\/options$/);
		await expect(
			page.getByRole("dialog", { name: "Mix options" }),
		).toBeVisible();
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).toBe(resetGoalSignature);
		await page.goForward();
		await expect(page).toHaveURL(/\/mix$/);
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).toBe(resetGoalSignature);
		await page.reload();
		await waitForAppReady(page);
		await expectSelectedIngredientCount(0);
		await expect.poll(currentGoalSignature).toBe(resetGoalSignature);
	} finally {
		await deleteLocalQaSavedRecipesByNamePrefix(
			testInfo.parallelIndex,
			recipeName,
		);
		await restoreLocalQaMixGoalConfiguration(
			testInfo.parallelIndex,
			originalGoalConfiguration,
		);
	}
});
