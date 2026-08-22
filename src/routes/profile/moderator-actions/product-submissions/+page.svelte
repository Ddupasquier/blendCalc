<script lang="ts">
	import { goto } from "$app/navigation";
	import ModeratorActionWorkspaceView from "$lib/components/moderation/ModeratorActionWorkspaceView/ModeratorActionWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { ProductSubmissionsPageProps } from "./types";

	let { data, form }: ProductSubmissionsPageProps = $props();

	const closeAction = () => {
		void goto("/profile/moderator-actions", { replaceState: true });
	};
</script>

<ProfilePage />
<ModeratorActionWorkspaceView
	id="profile-product-submissions-view"
	title="Product submissions"
	subtitle="Compare package evidence with the submitted values before publishing a shared product."
	{data}
	{form}
	scope="product-submissions"
	onClose={closeAction}
/>
