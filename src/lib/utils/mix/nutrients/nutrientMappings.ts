import { NUTRIENT_IDS } from "$lib/utils/food/types";

export const LEGACY_SODIUM_NUTRIENT_ID = 1258;

export const hasLegacySodiumOption = (
	options: { id: string | number; label: string }[],
) => {
	return options.some(
		(option) =>
			Number(option.id) === LEGACY_SODIUM_NUTRIENT_ID &&
			option.label.trim().toLowerCase() === "sodium",
	);
};

export const migrateLegacyNutrientIds = (
	ids: (string | number)[],
	shouldMigrateLegacySodium = false,
) => {
	return [
		...new Set(
			ids.map((id) =>
				shouldMigrateLegacySodium &&
				Number(id) === LEGACY_SODIUM_NUTRIENT_ID
					? NUTRIENT_IDS.SODIUM
					: id,
			),
		),
	];
};

export const migrateLegacyNutrientOptions = <
	T extends { id: string | number; label: string },
>(options: T[]) => {
	const seen = new Set<string>();

	return options.flatMap((option) => {
		const isLegacySodium =
			Number(option.id) === LEGACY_SODIUM_NUTRIENT_ID &&
			option.label.trim().toLowerCase() === "sodium";
		const id = isLegacySodium ? NUTRIENT_IDS.SODIUM : option.id;
		const key = String(id);
		if (seen.has(key)) return [];
		seen.add(key);

		return [
			{
				...option,
				id,
				label: isLegacySodium ? "Sodium" : option.label,
			},
		];
	});
};

export const migrateLegacyNutrientGoals = (
	goals: Record<number, number>,
	shouldMigrateLegacySodium = false,
) => {
	const migratedGoals = { ...goals };
	if (!shouldMigrateLegacySodium) return migratedGoals;

	const legacyGoal = migratedGoals[LEGACY_SODIUM_NUTRIENT_ID];

	if (
		legacyGoal !== undefined &&
		migratedGoals[NUTRIENT_IDS.SODIUM] === undefined
	) {
		migratedGoals[NUTRIENT_IDS.SODIUM] = legacyGoal;
	}

	delete migratedGoals[LEGACY_SODIUM_NUTRIENT_ID];
	return migratedGoals;
};
