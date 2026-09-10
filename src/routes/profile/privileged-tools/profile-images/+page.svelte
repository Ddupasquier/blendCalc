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
	guide={{
		tone: data.profileImageReports.length > 0 ? "attention" : "clear",
		title:
			data.profileImageReports.length > 0
				? `Review ${data.profileImageReports.length} reported ${data.profileImageReports.length === 1 ? "image" : "images"}`
				: "No reported images need a decision",
		description:
			data.profileImageReports.length > 0
				? "Inspect the exact image and all attached report reasons, then keep or remove it with a private evidence note."
				: "Ordinary profile images never wait here. This queue appears only when another user reports a current image.",
		completion:
			"Every reported image has one recorded keep-or-remove decision that addresses all pending reports for that exact image.",
		count: data.profileImageReports.length,
		countLabel: "reported profile images requiring review",
	}}
	onClose={closeAction}
>
	<ProfileImageReportReviewList reports={data.profileImageReports} {form} />
</PrivilegedToolWorkspaceView>
