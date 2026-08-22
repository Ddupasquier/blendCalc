<script lang="ts">
	import { goto } from "$app/navigation";
	import ModeratorActionWorkspaceView from "$lib/components/moderation/ModeratorActionWorkspaceView/ModeratorActionWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { AccountAccessPageProps } from "./types";

	let { data, form }: AccountAccessPageProps = $props();

	const closeAction = () => {
		void goto("/profile/moderator-actions", { replaceState: true });
	};
</script>

<ProfilePage />
<ModeratorActionWorkspaceView
	id="profile-account-access-view"
	title="Account access"
	subtitle="Find an account, review its current standing, and block or restore access when policy requires it."
	{data}
	{form}
	scope="account-access"
	onClose={closeAction}
/>
