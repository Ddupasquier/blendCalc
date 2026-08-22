export const REGULATORY_REGION_SELECTION_SOURCES = [
	"account",
	"device",
] as const;

export type RegulatoryRegionSelectionSource =
	(typeof REGULATORY_REGION_SELECTION_SOURCES)[number];

export type RegulatoryRegionOption = {
	regionCode: string;
	displayName: string;
	authority: string;
	policyVersion?: number;
	policyReviewedAt?: string;
};

export const normalizeRegulatoryRegionCode = (
	value: FormDataEntryValue | null,
) => String(value ?? "").trim().toLocaleUpperCase();

export const normalizeRegulatoryRegionSource = (
	value: FormDataEntryValue | null,
): RegulatoryRegionSelectionSource | null => {
	const normalized = String(value ?? "").trim();
	return REGULATORY_REGION_SELECTION_SOURCES.includes(
		normalized as RegulatoryRegionSelectionSource,
	)
		? normalized as RegulatoryRegionSelectionSource
		: null;
};

export const isSupportedRegulatoryRegion = (
	regionCode: string,
	options: RegulatoryRegionOption[],
) => options.some((option) => option.regionCode === regionCode);

const readLocaleRegion = (locale: string) => {
	try {
		return new Intl.Locale(locale).region?.toLocaleUpperCase() ?? "";
	} catch {
		return "";
	}
};

export const getDeviceRegulatoryRegionSuggestion = (
	locales: readonly string[],
	options: RegulatoryRegionOption[],
) => {
	for (const locale of locales) {
		const localeRegion = readLocaleRegion(locale);
		if (!localeRegion) continue;

		const match = options.find((option) =>
			option.regionCode === localeRegion ||
			option.regionCode.split("-").includes(localeRegion),
		);
		if (match) return match.regionCode;
	}
	return "";
};
