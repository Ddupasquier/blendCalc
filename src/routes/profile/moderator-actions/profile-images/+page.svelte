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
	subtitle="Review profile images that have not received a moderation decision."
	{data}
	{form}
	scope="profile-images"
	onClose={closeAction}
/>
