<script lang="ts">
	import { goto } from "$app/navigation";
	import ModeratorActionWorkspaceView from "$lib/components/moderation/ModeratorActionWorkspaceView/ModeratorActionWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { ProfileImageReviewPageProps } from "./types";

	let { data, form }: ProfileImageReviewPageProps = $props();

	const closeAction = () => {
		void goto("/profile/moderator-actions", { replaceState: true });
	};
</script>

<ProfilePage />
<ModeratorActionWorkspaceView
	id="profile-image-reviews-view"
	title="Profile images"
	subtitle="Review profile images that another user reported. Ordinary uploads do not enter this queue."
	informationKey="profile-images"
	{data}
	{form}
	scope="profile-images"
	onClose={closeAction}
/>
