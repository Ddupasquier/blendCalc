<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { CatalogOperationsProductPageProps } from "./types";

	let { data }: CatalogOperationsProductPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools/data-operations", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolRightSheet
	id="profile-data-operations-product-view"
	title="Product readiness"
	subtitle="Inspect this product's catalog availability, API checks, evidence, and repair ownership."
	informationKey="data-operations"
	onClose={closeAction}
>
	<CatalogProductReadinessPassport passport={data.passport} />
</PrivilegedToolRightSheet>
