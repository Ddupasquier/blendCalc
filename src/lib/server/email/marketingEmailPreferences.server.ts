import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "$lib/types/database.types";
import {
	isMarketingEmailTopicKey,
	type MarketingEmailPreference,
	type MarketingEmailPreferenceValues,
} from "$lib/utils/email/marketingEmailPreferences";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;

export const readCurrentUserMarketingEmailPreferences = async (
	supabase: AuthenticatedSupabaseClient,
): Promise<MarketingEmailPreference[]> => {
	const { data, error } = await supabase.rpc(
		"get_current_user_marketing_email_preferences",
	);
	if (error) throw error;

	return (data ?? []).flatMap((preference) =>
		isMarketingEmailTopicKey(preference.topic_key)
			? [
					{
						topicKey: preference.topic_key,
						label: preference.label,
						description: preference.description,
						isSubscribed: preference.is_subscribed,
						updatedAt: preference.updated_at,
					},
				]
			: [],
	);
};

export const saveCurrentUserMarketingEmailPreferences = async (
	supabase: AuthenticatedSupabaseClient,
	values: MarketingEmailPreferenceValues,
	consentCopyVersion: string,
) =>
	supabase.rpc("save_current_user_marketing_email_preferences", {
		p_preferences: values as Json,
		p_consent_copy_version: consentCopyVersion,
	});
