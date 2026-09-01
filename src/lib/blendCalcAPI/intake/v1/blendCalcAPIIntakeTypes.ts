export const BLENDCALC_API_INTAKE_V1 = "1.0" as const;

export const BLENDCALC_API_INTAKE_V1_SECTIONS = [
	"identity",
	"labelRevision",
	"servings",
	"nutrients",
	"ingredients",
	"allergens",
	"categories",
	"identifiers",
	"images",
] as const;

export type BlendCalcAPIIntakeV1SectionName =
	(typeof BLENDCALC_API_INTAKE_V1_SECTIONS)[number];

export type BlendCalcAPIIntakeV1ObservationState =
	"reported" | "checked-none" | "not-observed";

export type BlendCalcAPIIntakeV1EvidenceReference = {
	evidenceIds: string[];
};

export type BlendCalcAPIIntakeV1ReportedText =
	BlendCalcAPIIntakeV1EvidenceReference & {
		value: string;
		languageCode: string | null;
	};

export type BlendCalcAPIIntakeV1Evidence = {
	clientEvidenceId: string;
	kind: "image";
	role:
		| "front-label"
		| "nutrition-label"
		| "ingredients-label"
		| "barcode"
		| "package-serving"
		| "other-label";
	mediaType: "image/jpeg" | "image/png" | "image/webp";
	byteLength: number;
	sha256: string;
	capturedAt: string | null;
};

export type BlendCalcAPIIntakeV1IdentityObservation = {
	productName: BlendCalcAPIIntakeV1ReportedText | null;
	brandName: BlendCalcAPIIntakeV1ReportedText | null;
	packageDescription: BlendCalcAPIIntakeV1ReportedText | null;
};

export type BlendCalcAPIIntakeV1LabelRevisionObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		labelObservedAt: string | null;
		manufacturerEffectiveAt: string | null;
		sourceRevision: string | null;
		expectedCanonicalProductId: string | null;
		expectedCanonicalRevisionNumber: number | null;
	};

export type BlendCalcAPIIntakeV1ServingObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		clientServingId: string;
		label: string;
		amount: number | null;
		unit: string | null;
		measureType: "weight" | "volume" | "count" | "package";
		gramWeight: number | null;
		milliliterVolume: number | null;
		isPrimary: boolean;
		isHouseholdMeasure: boolean;
	};

export type BlendCalcAPIIntakeV1NutrientBasis =
	| {
			kind: "mass";
			quantity: number;
			unit: string;
	  }
	| {
			kind: "volume";
			quantity: number;
			unit: string;
	  }
	| {
			kind: "serving";
			servingId: string;
	  };

export type BlendCalcAPIIntakeV1NutrientObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		nutrientId: number | null;
		sourceNutrientName: string;
		sourceNutrientCode: string | null;
		amount: number | null;
		unit: string;
		valueStatus:
			| "reported"
			| "reported-zero"
			| "below-reporting-threshold"
			| "present-unquantified";
		basis: BlendCalcAPIIntakeV1NutrientBasis;
		statement: string | null;
	};

export type BlendCalcAPIIntakeV1IngredientObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		clientIngredientId: string;
		parentClientIngredientId: string | null;
		order: number;
		text: string;
		percentage: {
			status: "reported-exact" | "reported-range" | "source-estimate";
			minimum: number;
			maximum: number;
		} | null;
	};

export type BlendCalcAPIIntakeV1IngredientsSection =
	BlendCalcAPIIntakeV1EvidenceReference & {
		state: BlendCalcAPIIntakeV1ObservationState;
		statement: string | null;
		languageCode: string | null;
		items: BlendCalcAPIIntakeV1IngredientObservation[];
	};

export type BlendCalcAPIIntakeV1PrecautionaryStatement =
	BlendCalcAPIIntakeV1EvidenceReference & {
		type:
			| "may-contain"
			| "shared-equipment"
			| "shared-facility"
			| "other-precautionary";
		text: string;
		allergens: string[];
		languageCode: string | null;
	};

export type BlendCalcAPIIntakeV1AllergensSection =
	BlendCalcAPIIntakeV1EvidenceReference & {
		state: BlendCalcAPIIntakeV1ObservationState;
		contains: string[];
		mayContain: string[];
		precautionaryStatements: BlendCalcAPIIntakeV1PrecautionaryStatement[];
	};

export type BlendCalcAPIIntakeV1CategoryObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		label: string;
		canonicalOptionId: string | null;
	};

export type BlendCalcAPIIntakeV1IdentifierObservation =
	BlendCalcAPIIntakeV1EvidenceReference & {
		type:
			"gtin" | "manufacturer-sku" | "retailer-sku" | "source-record" | "other";
		value: string;
		issuer: string | null;
		isPrimary: boolean;
	};

export type BlendCalcAPIIntakeV1ImageObservation = {
	evidenceId: string;
	role: "front" | "nutrition" | "ingredients" | "barcode" | "other";
	altText: string | null;
	intendedUse: "identity-evidence" | "field-evidence" | "catalog-candidate";
};

export type BlendCalcAPIIntakeV1ObservationSection<Value> = {
	state: BlendCalcAPIIntakeV1ObservationState;
	values: Value[];
};

export type BlendCalcAPIIntakeV1ProductObservation = {
	intakeVersion: typeof BLENDCALC_API_INTAKE_V1;
	purpose: "catalog-share" | "catalog-correction";
	observedAt: string;
	evidence: BlendCalcAPIIntakeV1Evidence[];
	observation: {
		identity: BlendCalcAPIIntakeV1IdentityObservation;
		labelRevision: BlendCalcAPIIntakeV1LabelRevisionObservation;
		servings: BlendCalcAPIIntakeV1ObservationSection<BlendCalcAPIIntakeV1ServingObservation>;
		nutrients: BlendCalcAPIIntakeV1ObservationSection<BlendCalcAPIIntakeV1NutrientObservation>;
		ingredients: BlendCalcAPIIntakeV1IngredientsSection;
		allergens: BlendCalcAPIIntakeV1AllergensSection;
		categories: BlendCalcAPIIntakeV1ObservationSection<BlendCalcAPIIntakeV1CategoryObservation>;
		identifiers: BlendCalcAPIIntakeV1ObservationSection<BlendCalcAPIIntakeV1IdentifierObservation>;
		images: BlendCalcAPIIntakeV1ObservationSection<BlendCalcAPIIntakeV1ImageObservation>;
	};
};
