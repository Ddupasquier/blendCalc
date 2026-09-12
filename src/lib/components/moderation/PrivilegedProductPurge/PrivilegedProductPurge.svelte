<script lang="ts">
	import { tick } from "svelte";
	import Trash from "$lib/assets/icons/Trash/Trash.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import {
		getCatalogProductPurgeSelectedCount,
		type CatalogProductPurgePreview,
		type CatalogProductPurgeResponse,
		type CatalogProductPurgeResult,
	} from "$lib/utils/moderation/catalogProductPurge";

	const panelId = "privileged-product-purge-panel";
	let open = $state(false);
	let barcode = $state("");
	let confirmationBarcode = $state("");
	let reason = $state("");
	let preview = $state<CatalogProductPurgePreview | null>(null);
	let result = $state<CatalogProductPurgeResult | null>(null);
	let error = $state("");
	let loading = $state(false);
	let launcherElement = $state<HTMLButtonElement | null>(null);

	const selectedCount = $derived(
		preview ? getCatalogProductPurgeSelectedCount(preview.counts) : 0,
	);
	const canPurge = $derived(
		Boolean(
			preview?.found &&
			confirmationBarcode.trim() === preview.normalizedBarcode &&
			reason.trim().length >= 10 &&
			reason.trim().length <= 1000,
		),
	);

	const close = () => {
		open = false;
		void tick().then(() => launcherElement?.focus({ preventScroll: true }));
	};

	const requestPurge = async (action: "preview" | "purge") => {
		loading = true;
		error = "";
		try {
			const response = await fetch("/api/moderation/product-purge", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					barcode,
					confirmationBarcode,
					reason,
				}),
			});
			const payload = (await response.json()) as
				CatalogProductPurgeResponse | { message?: string };
			if (!response.ok) {
				throw new Error(
					"message" in payload && payload.message
						? payload.message
						: `Product deletion failed (${response.status})`,
				);
			}
			if (!("action" in payload)) {
				throw new Error("The product deletion response was incomplete.");
			}
			if (payload.action === "preview") {
				preview = payload.preview;
				result = null;
				barcode = payload.preview.normalizedBarcode;
				confirmationBarcode = "";
			} else {
				result = payload.result;
				preview = null;
				confirmationBarcode = "";
				reason = "";
			}
		} catch (requestError) {
			error = getUserFacingErrorMessage(requestError, {
				fallback:
					"The product deletion could not be completed. Nothing else should be changed until this error is reviewed.",
				network:
					"The deletion tool could not connect. Check your connection and try the preview again.",
			});
		} finally {
			loading = false;
		}
	};
</script>

<RoundedActionButton
	bind:element={launcherElement}
	variant="neutral"
	aria-expanded={open}
	aria-controls={panelId}
	onclick={() => (open = true)}
>
	<Trash size={17} />
	<span>Delete product</span>
</RoundedActionButton>

{#if open}
	<div
		id={panelId}
		class="privileged-product-purge"
		role="dialog"
		aria-modal="true"
		aria-labelledby="privileged-product-purge-title"
	>
		<header>
			<div>
				<small>Destructive Supabase operation</small>
				<h2 id="privileged-product-purge-title">Delete a product everywhere</h2>
			</div>
			<CircleIconButton
				label="Close product deletion tool"
				variant="ghost"
				size="small"
				onclick={close}
			>
				<X size={18} />
			</CircleIconButton>
		</header>

		<div class="privileged-product-purge__body">
			<StatusMessage tone="danger" title="This cannot be undone">
				<p>
					Deleting removes the catalog product, submissions, revisions,
					evidence, moderation work, provider cache, and any users’ list or
					saved-mix copies that contain this UPC. It does not delete accounts,
					unrelated products, or shared source definitions. Closing this tool or
					leaving confirmation incomplete changes nothing.
				</p>
			</StatusMessage>

			<TextField
				id="catalog-product-purge-barcode"
				label="UPC / GTIN to delete"
				value={barcode}
				placeholder="Example: 00000000772914"
				autocomplete="off"
				disabled={loading}
				oninput={(event) => {
					barcode = event.currentTarget.value;
					preview = null;
					result = null;
					error = "";
				}}
			/>
			<RoundedActionButton
				variant="outline"
				fullWidth
				busy={loading}
				disabled={!barcode.trim() || loading}
				onclick={() => void requestPurge("preview")}
			>
				Preview exact deletion
			</RoundedActionButton>

			{#if error}
				<StatusMessage tone="danger" message={error} />
			{/if}
			{#if result}
				<StatusMessage
					tone="success"
					title="Product deletion verified"
					message={`${result.normalizedBarcode} and its selected Supabase records were deleted. ${result.storageObjectsDeleted} private Storage ${result.storageObjectsDeleted === 1 ? "object was" : "objects were"} removed.`}
				/>
			{/if}

			{#if preview}
				<section class="privileged-product-purge__preview">
					<div>
						<small>Exact product selected</small>
						<h3>{preview.productName ?? "Product record not available"}</h3>
						<p>{preview.brandOwner ?? "Brand not stored"}</p>
						<strong>{preview.normalizedBarcode}</strong>
					</div>
					{#if preview.found}
						<p>
							<strong>{selectedCount} records are selected.</strong> This
							includes
							{preview.counts.products} catalog product,
							{preview.counts.submissions} submissions,
							{preview.counts.revisions} revisions,
							{preview.counts.observations} observations,
							{preview.counts.providerSnapshots} provider snapshots,
							{preview.counts.images} images,
							{preview.counts.userListItems} user list items, and
							{preview.counts.savedMixes} saved or active mixes. Related conflicts,
							warnings, and cache entries are included in the total.
						</p>
						<TextField
							id="catalog-product-purge-reason"
							label="Why is this product being completely removed?"
							value={reason}
							placeholder="Example: Development fixture with conflicting source identity."
							helper="Saved in the private purge audit. Do not repeat the UPC here."
							multiline
							rows={3}
							minlength={10}
							maxlength={1000}
							disabled={loading}
							oninput={(event) => (reason = event.currentTarget.value)}
						/>
						<TextField
							id="catalog-product-purge-confirmation"
							label={`Type ${preview.normalizedBarcode} to confirm`}
							value={confirmationBarcode}
							autocomplete="off"
							disabled={loading}
							oninput={(event) =>
								(confirmationBarcode = event.currentTarget.value.trim())}
						/>
						<ActionButton
							variant="danger"
							fullWidth
							busy={loading}
							disabled={!canPurge || loading}
							onclick={() => void requestPurge("purge")}
						>
							Permanently delete product records
						</ActionButton>
					{:else}
						<StatusMessage
							tone="info"
							title="Nothing to delete"
							message="No catalog, evidence, cache, or user-owned product records matched this UPC / GTIN."
						/>
					{/if}
				</section>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	@use "./PrivilegedProductPurge.scss";
</style>
