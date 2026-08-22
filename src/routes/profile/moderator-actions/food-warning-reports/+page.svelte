<script lang="ts">
	import { goto } from "$app/navigation";
	import ModeratorActionWorkspaceView from "$lib/components/moderation/ModeratorActionWorkspaceView/ModeratorActionWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { FoodWarningReportsPageProps } from "./types";

	let { data, form }: FoodWarningReportsPageProps = $props();

	const closeAction = () => {
		void goto("/profile/moderator-actions", { replaceState: true });
	};
</script>

<ProfilePage />
<ModeratorActionWorkspaceView
	id="profile-food-warning-reports-view"
	title="Food warning reports"
	subtitle="Review reports about missing or incorrect food warnings, then record the evidence-backed next step."
	informationKey="food-warning-reports"
	{data}
	{form}
	scope="food-warning-reports"
	onClose={closeAction}
/>
