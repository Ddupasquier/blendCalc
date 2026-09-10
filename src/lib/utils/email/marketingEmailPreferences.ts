export const MARKETING_EMAIL_CONSENT_COPY_VERSION =
	"marketing-consent-2026-09-09";

export const MARKETING_EMAIL_TOPIC_KEYS = [
	"product_and_launch_updates",
	"mvp_testing_invitations",
	"tips_recipes_and_education",
] as const;

export type MarketingEmailTopicKey =
	(typeof MARKETING_EMAIL_TOPIC_KEYS)[number];

export type MarketingEmailPreference = {
	topicKey: MarketingEmailTopicKey;
	label: string;
	description: string;
	isSubscribed: boolean;
	updatedAt: string | null;
};

export type MarketingEmailPreferenceValues = Record<
	MarketingEmailTopicKey,
	boolean
>;

export const getDefaultMarketingEmailPreferenceValues =
	(): MarketingEmailPreferenceValues => ({
		product_and_launch_updates: false,
		mvp_testing_invitations: false,
		tips_recipes_and_education: false,
	});

export const isMarketingEmailTopicKey = (
	value: string,
): value is MarketingEmailTopicKey =>
	MARKETING_EMAIL_TOPIC_KEYS.includes(value as MarketingEmailTopicKey);

export const getMarketingEmailPreferenceValues = (
	preferences: MarketingEmailPreference[],
): MarketingEmailPreferenceValues => {
	const values = getDefaultMarketingEmailPreferenceValues();
	for (const preference of preferences) {
		values[preference.topicKey] = preference.isSubscribed;
	}
	return values;
};
