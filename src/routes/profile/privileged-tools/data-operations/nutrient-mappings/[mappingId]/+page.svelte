<script lang="ts">
	import { goto } from "$app/navigation";
	import NutrientMappingReview from "$lib/components/moderation/NutrientMappingReview/NutrientMappingReview.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { NutrientMappingReviewPageProps } from "./types";

	let { data, form }: NutrientMappingReviewPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools/data-operations", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-nutrient-mapping-review"
	title="Review nutrient mapping"
	subtitle="Confirm an exact nutrient identity only when the provider key and units are supported by evidence."
	informationKey="data-operations"
	guide={{
		tone:
			data.workspace.mapping.reviewStatus === "pending_review"
				? "attention"
				: "clear",
		title:
			data.workspace.mapping.reviewStatus === "pending_review"
				? "Confirm or exclude this nutrient identity"
				: "This nutrient decision is complete",
		description:
			data.workspace.mapping.reviewStatus === "pending_review"
				? "Compare the provider key, unit, suggested nutrient, and external evidence. Approve only an exact identity; otherwise exclude the candidate."
				: "The recorded decision remains visible below for audit and does not need another routine review.",
		completion:
			"The provider key is either mapped to an evidence-backed compatible nutrient or explicitly excluded with a private review note.",
		count: data.workspace.mapping.reviewStatus === "pending_review" ? 1 : 0,
		countLabel: "nutrient mapping requiring review",
	}}
	onClose={closeAction}
>
	<NutrientMappingReview workspace={data.workspace} {form} />
</PrivilegedToolWorkspaceView>
