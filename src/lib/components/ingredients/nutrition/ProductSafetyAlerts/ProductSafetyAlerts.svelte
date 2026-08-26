<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { ProductSafetyAlertsProps } from "./types";

	let {
		food,
		alerts: providedAlerts,
		mode = "all",
	}: ProductSafetyAlertsProps = $props();
	const alerts = $derived(providedAlerts ?? food?.safetyAlerts ?? []);
	const showSummary = $derived(mode !== "details");
	const showDetails = $derived(mode !== "summary");
	const requiresPackageCheck = $derived(
		alerts.some((alert) => alert.requiresPackageCheck),
	);
</script>

{#if alerts.length > 0}
	<section
		class="product-safety-alerts"
		aria-label="Official food safety alerts"
	>
		{#if showSummary}
			<StatusMessage
				tone="danger"
				iconPlacement="top-end"
				title={requiresPackageCheck
					? "Check your package"
					: "Active food safety recall"}
			>
				<p class="product-safety-alerts__summary">
					{requiresPackageCheck
						? "This product may be part of an active recall. Check the lot or date code on your package against the official notice."
						: "This product appears in an active official recall. Review the official notice before using it."}
				</p>
			</StatusMessage>
		{/if}

		{#if showDetails}
			<CollapsibleSection
				title="Official food safety notices"
				badge={String(alerts.length)}
				surface="panel"
				tone="danger"
			>
				<div class="product-safety-alerts__details">
					{#each alerts as alert}
						<article class="product-safety-alerts__notice">
							<div class="product-safety-alerts__heading">
								<strong>{alert.productDescription}</strong>
								{#if alert.classification}
									<span>{alert.classification}</span>
								{/if}
							</div>
							{#if alert.reason}
								<p>{alert.reason}</p>
							{/if}
							{#if alert.requiresPackageCheck}
								<p>
									<strong>Check your package:</strong> The notice is limited by package,
									lot, or date information.
								</p>
							{/if}
							<p class="product-safety-alerts__source">
								{alert.sourceAttribution}
								{#if alert.reportDate}
									· Reported {alert.reportDate}{/if}
							</p>
							<a href={alert.sourceUrl} target="_blank" rel="noreferrer">
								Read the official notice
							</a>
						</article>
					{/each}
					<p class="product-safety-alerts__disclaimer">
						Official recall data is safety information, not medical advice. If
						anyone may be ill or injured, contact a qualified medical
						professional.
					</p>
				</div>
			</CollapsibleSection>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "./ProductSafetyAlerts.scss";
</style>
