<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { CatalogReviewProductPageProps } from "./types";

	let { data }: CatalogReviewProductPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools/catalog-review-work", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolRightSheet
	id="profile-catalog-review-product-view"
	title="Product readiness"
	subtitle="Review this product's current evidence, conflicts, and correction needs."
	informationKey="catalog-review-work"
	onClose={closeAction}
>
	<CatalogProductReadinessPassport passport={data.passport} />
</PrivilegedToolRightSheet>
