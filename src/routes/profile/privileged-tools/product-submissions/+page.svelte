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
	guide={{
		tone: data.productSubmissions.length > 0 ? "attention" : "clear",
		title:
			data.productSubmissions.length > 0
				? `Review ${data.productSubmissions.length} ${data.productSubmissions.length === 1 ? "submission" : "submissions"}`
				: "No submissions need a decision",
		description:
			data.productSubmissions.length > 0
				? "Open the first card, compare the submitted values with its package evidence, then approve or explain what must be corrected."
				: "There is nothing to review right now. New evidence-backed submissions will appear here automatically.",
		completion:
			"Every submission has either been approved from sufficient evidence or rejected with a useful correction note.",
		count: data.productSubmissions.length,
		countLabel: "product submissions requiring review",
	}}
	onClose={closeAction}
>
	<ProductSubmissionReviewList submissions={data.productSubmissions} {form} />
</PrivilegedToolWorkspaceView>
