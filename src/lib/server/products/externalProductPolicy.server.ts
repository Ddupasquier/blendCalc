import { env } from "$env/dynamic/private";

export const areExternalProductLookupsEnabled = (
	databaseEnvironment = env.BLENDCALC_DATABASE_ENVIRONMENT,
) => databaseEnvironment !== "test";
