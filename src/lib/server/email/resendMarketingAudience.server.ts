import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";
import {
	MARKETING_EMAIL_TOPIC_KEYS,
	type MarketingEmailPreferenceValues,
	type MarketingEmailTopicKey,
} from "$lib/utils/email/marketingEmailPreferences";

const RESEND_CONTACTS_ENDPOINT = "https://api.resend.com/contacts";

export type ResendMarketingTopicIds = Record<MarketingEmailTopicKey, string>;

type SyncResendMarketingContactInput = {
	apiKey: string;
	email: string;
	preferences: MarketingEmailPreferenceValues;
	topicIds: ResendMarketingTopicIds;
};

export type ResendMarketingAudienceSyncResult =
	| { status: "synced"; contactId: string | null }
	| { status: "failed"; errorCode: string; errorMessage: string };

const getTopicSubscriptions = (
	preferences: MarketingEmailPreferenceValues,
	topicIds: ResendMarketingTopicIds,
) =>
	MARKETING_EMAIL_TOPIC_KEYS.map((topicKey) => ({
		id: topicIds[topicKey],
		subscription: preferences[topicKey] ? "opt_in" : "opt_out",
	}));

const requestResend = async (
	endpoint: string,
	apiKey: string,
	method: "POST" | "PATCH",
	body: object,
) => {
	const response = await fetchWithExternalRequestPolicy(endpoint, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		timeoutMilliseconds: 10_000,
		maxAttempts: 2,
	});
	const responseBody = (await response.json().catch(() => null)) as {
		id?: string;
		name?: string;
		message?: string;
	} | null;
	return { response, responseBody };
};

export const syncResendMarketingContact = async ({
	apiKey,
	email,
	preferences,
	topicIds,
}: SyncResendMarketingContactInput): Promise<ResendMarketingAudienceSyncResult> => {
	const normalizedEmail = email.trim().toLowerCase();
	const topicSubscriptions = getTopicSubscriptions(preferences, topicIds);
	const globallyUnsubscribed = Object.values(preferences).every(
		(isSubscribed) => !isSubscribed,
	);

	if (
		!normalizedEmail.includes("@") ||
		topicSubscriptions.some(({ id }) => !id.trim())
	) {
		return {
			status: "failed",
			errorCode: "marketing_audience_configuration_invalid",
			errorMessage: "A valid contact and every provider topic ID are required.",
		};
	}

	try {
		const createResult = await requestResend(
			RESEND_CONTACTS_ENDPOINT,
			apiKey,
			"POST",
			{
				email: normalizedEmail,
				unsubscribed: globallyUnsubscribed,
				topics: topicSubscriptions,
			},
		);
		if (createResult.response.ok) {
			return {
				status: "synced",
				contactId: createResult.responseBody?.id ?? null,
			};
		}

		if (createResult.response.status !== 409) {
			return {
				status: "failed",
				errorCode:
					createResult.responseBody?.name ??
					`marketing_audience_http_${createResult.response.status}`,
				errorMessage:
					createResult.responseBody?.message ??
					"The email provider rejected the contact.",
			};
		}

		const encodedEmail = encodeURIComponent(normalizedEmail);
		const contactResult = await requestResend(
			`${RESEND_CONTACTS_ENDPOINT}/${encodedEmail}`,
			apiKey,
			"PATCH",
			{ unsubscribed: globallyUnsubscribed },
		);
		if (!contactResult.response.ok) {
			return {
				status: "failed",
				errorCode:
					contactResult.responseBody?.name ??
					`marketing_audience_http_${contactResult.response.status}`,
				errorMessage:
					contactResult.responseBody?.message ??
					"The email provider rejected the contact status.",
			};
		}

		const topicsResult = await requestResend(
			`${RESEND_CONTACTS_ENDPOINT}/${encodedEmail}/topics`,
			apiKey,
			"PATCH",
			{ topics: topicSubscriptions },
		);
		if (!topicsResult.response.ok) {
			return {
				status: "failed",
				errorCode:
					topicsResult.responseBody?.name ??
					`marketing_audience_http_${topicsResult.response.status}`,
				errorMessage:
					topicsResult.responseBody?.message ??
					"The email provider rejected the topic preferences.",
			};
		}

		return {
			status: "synced",
			contactId: contactResult.responseBody?.id ?? null,
		};
	} catch (error) {
		return {
			status: "failed",
			errorCode: "marketing_audience_network_error",
			errorMessage:
				error instanceof Error
					? error.message
					: "The marketing audience request failed.",
		};
	}
};
