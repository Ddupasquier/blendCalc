<script lang="ts">
	import { goto } from "$app/navigation";
	import FoodWarningFollowUpList from "$lib/components/moderation/FoodWarningFollowUpList/FoodWarningFollowUpList.svelte";
	import FoodWarningReportReviewList from "$lib/components/moderation/FoodWarningReportReviewList/FoodWarningReportReviewList.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { FoodWarningReportsPageProps } from "./types";

	let { data, form }: FoodWarningReportsPageProps = $props();

	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-food-warning-reports-view"
	title="Food warning reports"
	subtitle="Review reports about missing or incorrect food warnings, then record the evidence-backed next step."
	informationKey="food-warning-reports"
	guide={{
		tone: data.compatibilityFeedback.length > 0 ? "attention" : "clear",
		title:
			data.compatibilityFeedback.length > 0
				? `Review ${data.compatibilityFeedback.length} ${data.compatibilityFeedback.length === 1 ? "warning report" : "warning reports"}`
				: "No warning reports need a decision",
		description:
			data.compatibilityFeedback.length > 0
				? "Start with the oldest report, compare the user's claim with the stored policy and package evidence, then assign the correct follow-up."
				: "No one is waiting on a warning review. Confirmed reports with unfinished corrective work remain listed below.",
		completion:
			"Every report has an evidence-backed outcome and any required correction has a clear owner in follow-up work.",
		count: data.compatibilityFeedback.length,
		countLabel: "food warning reports requiring review",
	}}
	onClose={closeAction}
>
	<FoodWarningReportReviewList reports={data.compatibilityFeedback} {form} />
	<FoodWarningFollowUpList followUps={data.compatibilityFollowUps} />
</PrivilegedToolWorkspaceView>
