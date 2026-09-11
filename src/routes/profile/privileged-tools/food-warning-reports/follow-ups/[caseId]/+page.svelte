<script lang="ts">
	import { goto } from "$app/navigation";
	import FoodWarningFollowUpReview from "$lib/components/moderation/FoodWarningFollowUpReview/FoodWarningFollowUpReview.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { FoodWarningFollowUpPageProps } from "./types";

	let { data, form }: FoodWarningFollowUpPageProps = $props();
	const isTerminal = $derived(
		data.reviewCase.status === "resolved" ||
			data.reviewCase.status === "dismissed",
	);
	const closeAction = () => {
		void goto("/profile/privileged-tools/food-warning-reports", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-food-warning-follow-up-view"
	title={data.reviewCase.caseType === "rule_review"
		? "Review warning rule"
		: "Review warning source"}
	subtitle={isTerminal
		? "Review the completed decision, evidence, and retained private notes."
		: "Use the captured report and reviewed evidence to finish or deliberately defer this follow-up."}
	informationKey="food-warning-reports"
	guide={{
		tone: isTerminal ? "clear" : "attention",
		title: isTerminal
			? "This follow-up is finished"
			: data.canResolve
				? "Record one evidence-backed outcome"
				: "Inspect the evidence, then hand off to Data operations",
		description: isTerminal
			? "No action remains. The completed decision, evidence, and private notes stay available below as a read-only audit record."
			: data.canResolve
				? "Choose resolved only after evidence or a separately applied change addresses the report. Dismiss only when no change is required; defer when a named prerequisite is missing."
				: "Your role can read this report but cannot finish its source-correction work. The required owner and permission are shown below.",
		completion:
			"The case returns to the warning queue as completed, dismissed, or still open with an explicit prerequisite.",
		count: !isTerminal && data.canResolve ? 1 : 0,
		countLabel: "follow-up decisions available on this screen",
	}}
	onClose={closeAction}
>
	{#if form?.followUpError}<p role="alert">{form.followUpError}</p>{/if}
	<FoodWarningFollowUpReview
		reviewCase={data.reviewCase}
		canResolve={data.canResolve}
	/>
</PrivilegedToolWorkspaceView>
