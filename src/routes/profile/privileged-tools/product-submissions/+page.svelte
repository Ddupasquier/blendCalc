<script lang="ts">
	import { goto } from "$app/navigation";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProductSubmissionReviewList from "$lib/components/moderation/ProductSubmissionReviewList/ProductSubmissionReviewList.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { ProductSubmissionsPageProps } from "./types";

	let { data, form }: ProductSubmissionsPageProps = $props();

	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-product-submissions-view"
	title="Product submissions"
	subtitle="Compare package evidence with the submitted values before publishing a shared product."
	informationKey="product-submissions"
	onClose={closeAction}
>
	<ProductSubmissionReviewList submissions={data.productSubmissions} {form} />
</PrivilegedToolWorkspaceView>
