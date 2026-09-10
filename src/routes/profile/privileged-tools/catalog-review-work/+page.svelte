<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogReviewWorkDashboard from "$lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogReviewWorkPageProps } from "./types";

	let { data, form }: CatalogReviewWorkPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
	const actionCount = $derived(
		data.reviewWork.counts.safetyMatches +
			data.reviewWork.counts.conflicts +
			data.reviewWork.counts.providerChanges,
	);
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-catalog-review-work-view"
	title="Catalog review work"
	subtitle="Resolve evidence-backed product changes, conflicts, and possible recall matches."
	informationKey="catalog-review-work"
	guide={{
		tone: actionCount > 0 ? "attention" : "clear",
		title:
			actionCount > 0
				? `Resolve ${actionCount} catalog ${actionCount === 1 ? "decision" : "decisions"}`
				: "No catalog decisions need review",
		description:
			actionCount > 0
				? "Start with possible recalls, then product conflicts, then provider changes. The current approved product remains unchanged until evidence supports a correction."
				: "There are no possible recall matches, product conflicts, or provider changes waiting for a decision.",
		completion:
			"Every item has a recorded evidence-based decision, and supported changes are routed into a separate catalog correction.",
		count: actionCount,
		countLabel: "catalog decisions requiring review",
	}}
	feedbackMessage={form?.catalogReviewError ?? form?.catalogReviewSuccess}
	feedbackTone={form?.catalogReviewError ? "danger" : "success"}
	onClose={closeAction}
>
	<CatalogReviewWorkDashboard reviewWork={data.reviewWork} />
</PrivilegedToolWorkspaceView>
