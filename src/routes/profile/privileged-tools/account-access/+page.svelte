<script lang="ts">
	import { goto } from "$app/navigation";
	import AccountAccessReviewList from "$lib/components/moderation/AccountAccessReviewList/AccountAccessReviewList.svelte";
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
	guide={{
		tone: "lookup",
		title: "Search for the exact account first",
		description:
			"Use a name, email, user ID, role, or status. Open one result, verify that it is the intended account, and use access controls only when policy requires a change.",
		completion:
			"The intended account's standing is confirmed and any necessary block or restoration is recorded with the reason shown to the user.",
	}}
	feedbackMessage={form?.moderationError ??
		form?.moderationWarning ??
		form?.moderationSuccess}
	feedbackTone={form?.moderationError
		? "danger"
		: form?.moderationWarning
			? "warning"
			: "success"}
	onClose={closeAction}
>
	<AccountAccessReviewList
		users={data.users}
		query={data.query}
		totalCount={data.totalCount}
		viewerUserId={data.viewerUserId}
		viewerRole={data.viewerRole}
		searchPath="/profile/privileged-tools/account-access"
	/>
</PrivilegedToolWorkspaceView>
