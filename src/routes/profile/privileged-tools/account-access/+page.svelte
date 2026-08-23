<script lang="ts">
	import { goto } from "$app/navigation";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { AccountAccessPageProps } from "./types";

	let { data, form }: AccountAccessPageProps = $props();

	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-account-access-view"
	title="Account access"
	subtitle="Find an account, review its current standing, and block or restore access when policy requires it."
	informationKey="account-access"
	{data}
	{form}
	scope="account-access"
	onClose={closeAction}
/>
