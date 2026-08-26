<script lang="ts">
	import { goto } from "$app/navigation";
	import NutrientMappingReview from "$lib/components/moderation/NutrientMappingReview/NutrientMappingReview.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
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
<PrivilegedToolRightSheet
	id="profile-nutrient-mapping-review"
	title="Review nutrient mapping"
	subtitle="Confirm an exact nutrient identity only when the provider key and units are supported by evidence."
	informationKey="data-operations"
	onClose={closeAction}
>
	<NutrientMappingReview workspace={data.workspace} {form} />
</PrivilegedToolRightSheet>
