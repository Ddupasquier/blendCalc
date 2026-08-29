export const BLENDCALC_API_SCOPE_KEYS = [
	"catalog.read",
	"intake.write",
	"corrections.write",
	"moderation.read",
	"moderation.write",
	"administration",
] as const;

export type BlendCalcAPIScope = (typeof BLENDCALC_API_SCOPE_KEYS)[number];

export const BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS = {
	"catalog.read": "catalog.read",
	"intake.submit": "intake.write",
	"corrections.submit": "corrections.write",
	"moderation.read": "moderation.read",
	"moderation.resolve": "moderation.write",
	"administration.manage": "administration",
} as const satisfies Record<string, BlendCalcAPIScope>;

export type BlendCalcAPIOperation =
	keyof typeof BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS;

const BLENDCALC_API_IMPLIED_SCOPES: Readonly<
	Record<BlendCalcAPIScope, readonly BlendCalcAPIScope[]>
> = {
	"catalog.read": ["catalog.read"],
	"intake.write": ["intake.write"],
	"corrections.write": ["corrections.write"],
	"moderation.read": ["moderation.read"],
	"moderation.write": ["moderation.read", "moderation.write"],
	administration: BLENDCALC_API_SCOPE_KEYS,
};

const BLENDCALC_API_SCOPE_KEY_SET = new Set<string>(BLENDCALC_API_SCOPE_KEYS);

export const isBlendCalcAPIScope = (
	value: string,
): value is BlendCalcAPIScope => BLENDCALC_API_SCOPE_KEY_SET.has(value);

export const readValidBlendCalcAPIScopes = (
	storedScopes: readonly string[],
): BlendCalcAPIScope[] => {
	const invalidScope = storedScopes.find(
		(scope) => !isBlendCalcAPIScope(scope),
	);
	if (invalidScope) {
		throw new Error("Stored blendCalcAPI access scopes are invalid.");
	}
	return [...new Set(storedScopes as readonly BlendCalcAPIScope[])];
};

export const canBlendCalcAPIScopesPerformOperation = (
	assignedScopes: readonly BlendCalcAPIScope[],
	operation: BlendCalcAPIOperation,
) => {
	const effectiveScopes = new Set(
		assignedScopes.flatMap((scope) => BLENDCALC_API_IMPLIED_SCOPES[scope]),
	);
	return effectiveScopes.has(
		BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS[operation],
	);
};
