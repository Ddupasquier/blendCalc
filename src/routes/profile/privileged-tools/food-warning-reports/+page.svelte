<script lang="ts">
	import { goto } from "$app/navigation";
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
	{data}
	{form}
	scope="food-warning-reports"
	onClose={closeAction}
/>
