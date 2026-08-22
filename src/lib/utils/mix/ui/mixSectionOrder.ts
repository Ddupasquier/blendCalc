export const MIX_SECTION_DEFINITIONS = [
	{ id: "nutrient-shape", label: "Nutrient shape" },
	{ id: "goals", label: "Goals" },
	{ id: "selected-ingredients", label: "Selected ingredients" },
	{ id: "add-ingredients", label: "Add ingredients" },
	{ id: "warnings", label: "Warnings" },
	{ id: "suggested-adjustments", label: "Suggested adjustments" },
	{ id: "nutrient-contributions", label: "What is driving this shape" },
] as const;

export type MixSectionId = (typeof MIX_SECTION_DEFINITIONS)[number]["id"];
export type MixSectionAttentionTone = "neutral" | "warning" | "danger";
export type MixSectionDisclosureProps = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const DEFAULT_MIX_SECTION_ORDER: MixSectionId[] =
	MIX_SECTION_DEFINITIONS.map(({ id }) => id);

export type MixSectionDisclosureState = Record<MixSectionId, boolean>;

export const DEFAULT_MIX_SECTION_DISCLOSURE_STATE: MixSectionDisclosureState = {
	"nutrient-shape": true,
	goals: true,
	"selected-ingredients": true,
	"add-ingredients": true,
	warnings: false,
	"suggested-adjustments": false,
	"nutrient-contributions": false,
};

const sectionIds = new Set<MixSectionId>(DEFAULT_MIX_SECTION_ORDER);

export const isMixSectionId = (value: unknown): value is MixSectionId =>
	typeof value === "string" && sectionIds.has(value as MixSectionId);

export const normalizeMixSectionOrder = (value: unknown): MixSectionId[] => {
	const persistedIds = Array.isArray(value) ? value : [];
	const uniqueIds = persistedIds.filter(
		(sectionId, index): sectionId is MixSectionId =>
			isMixSectionId(sectionId) && persistedIds.indexOf(sectionId) === index,
	);

	return [
		...uniqueIds,
		...DEFAULT_MIX_SECTION_ORDER.filter(
			(sectionId) => !uniqueIds.includes(sectionId),
		),
	];
};

export const getMixSectionOrderForIngredientAvailability = (
	order: readonly MixSectionId[],
	hasAvailableIngredients: boolean,
): MixSectionId[] => {
	const normalizedOrder = normalizeMixSectionOrder(order);
	if (hasAvailableIngredients) return normalizedOrder;

	return [
		"add-ingredients",
		...normalizedOrder.filter((sectionId) => sectionId !== "add-ingredients"),
	];
};

export const normalizeMixSectionDisclosureState = (
	value: unknown,
): MixSectionDisclosureState => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { ...DEFAULT_MIX_SECTION_DISCLOSURE_STATE };
	}

	const persistedState = value as Record<string, unknown>;
	return Object.fromEntries(
		DEFAULT_MIX_SECTION_ORDER.map((sectionId) => [
			sectionId,
			typeof persistedState[sectionId] === "boolean"
				? persistedState[sectionId]
				: DEFAULT_MIX_SECTION_DISCLOSURE_STATE[sectionId],
		]),
	) as MixSectionDisclosureState;
};

export const getMixSectionLabel = (sectionId: MixSectionId) =>
	MIX_SECTION_DEFINITIONS.find(({ id }) => id === sectionId)?.label ?? sectionId;

export const moveMixSection = (
	order: readonly MixSectionId[],
	sectionId: MixSectionId,
	targetIndex: number,
): MixSectionId[] => {
	const currentIndex = order.indexOf(sectionId);
	if (currentIndex < 0) return normalizeMixSectionOrder(order);

	const nextOrder = order.filter((id) => id !== sectionId);
	const boundedIndex = Math.max(0, Math.min(targetIndex, nextOrder.length));
	nextOrder.splice(boundedIndex, 0, sectionId);
	return nextOrder;
};

export const moveMixSectionRelative = (
	order: readonly MixSectionId[],
	sectionId: MixSectionId,
	targetId: MixSectionId,
	placeAfter: boolean,
): MixSectionId[] => {
	if (sectionId === targetId) return [...order];
	const withoutSection = order.filter((id) => id !== sectionId);
	const targetIndex = withoutSection.indexOf(targetId);
	if (targetIndex < 0) return normalizeMixSectionOrder(order);
	return moveMixSection(
		order,
		sectionId,
		targetIndex + (placeAfter ? 1 : 0),
	);
};
