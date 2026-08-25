<script lang="ts">
	import { goto } from "$app/navigation";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfileImageReportReviewList from "$lib/components/moderation/ProfileImageReportReviewList/ProfileImageReportReviewList.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { ProfileImageReviewPageProps } from "./types";

	let { data, form }: ProfileImageReviewPageProps = $props();

	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-image-reviews-view"
	title="Profile images"
	subtitle="Review profile images that another user reported. Ordinary uploads do not enter this queue."
	informationKey="profile-images"
	onClose={closeAction}
>
	<ProfileImageReportReviewList reports={data.profileImageReports} {form} />
</PrivilegedToolWorkspaceView>
