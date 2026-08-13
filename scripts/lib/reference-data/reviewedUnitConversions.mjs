/**
 * Purpose: Provide the bounded UCUM conversions that blendCalc has reviewed and stores
 * as versioned database reference data. Values preserve the previously observed NLM
 * service results; this module performs no network requests.
 * Do not run directly; it is imported by product-reference seed workflows.
 */

export const UCUM_STANDARD_REFERENCE = {
	homepageUrl: "https://ucum.org/",
	licenseName: "UCUM License v1.1",
	licenseUrl: "https://ucum.org/license",
	specificationUrl: "https://ucum.org/ucum",
	specificationVersion: "2.2",
};

const REVIEWED_UCUM_CONVERSION_FACTORS = new Map([
	["g\u0000g", 1],
	["10*-3.g\u0000g", 0.001],
	["[oz_av]\u0000g", 28.349523],
	["kg\u0000g", 1000],
	["[lb_av]\u0000g", 453.59237],
	["mL\u0000mL", 1],
	["[tsp_us]\u0000mL", 4.9289216],
	["[tbs_us]\u0000mL", 14.786765],
	["[cup_us]\u0000mL", 236.58824],
	["[foz_us]\u0000mL", 29.57353],
	["g\u000010*-3.g", 1000],
	["g\u000010*-6.g", 1000000],
	["10*-3.g\u000010*-6.g", 1000],
	["10*-6.g\u0000g", 0.000001],
	["10*-6.g\u000010*-3.g", 0.001],
	["kcal\u0000kJ", 4.184],
	["kJ\u0000kcal", 0.23900574],
]);

export const getReviewedUcumConversion = ({ fromCode, toCode }) => {
	const value = REVIEWED_UCUM_CONVERSION_FACTORS.get(`${fromCode}\u0000${toCode}`);
	return value === undefined
		? null
		: {
			value,
			sourceReference: UCUM_STANDARD_REFERENCE.specificationUrl,
			specificationVersion: UCUM_STANDARD_REFERENCE.specificationVersion,
		};
};
