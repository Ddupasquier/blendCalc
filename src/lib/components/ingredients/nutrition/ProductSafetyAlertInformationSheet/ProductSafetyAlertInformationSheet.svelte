<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import type { ProductSafetyAlertInformationSheetProps } from "./types";

	let { open, alerts, onClose }: ProductSafetyAlertInformationSheetProps =
		$props();

	const officialNoticeDateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeZone: "UTC",
	});

	const formatOfficialNoticeDate = (value: string | undefined) => {
		if (!value) return "";
		const normalizedValue = /^\d{8}$/.test(value)
			? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
			: value;
		const parsedDate = new Date(normalizedValue);
		return Number.isNaN(parsedDate.getTime())
			? value
			: officialNoticeDateFormatter.format(parsedDate);
	};
</script>

<BottomSheet
	id="product-safety-alert-information"
	{open}
	title={alerts.length === 1
		? "Official safety notice"
		: "Official safety notices"}
	titleId="product-safety-alert-information-title"
	comfortable
	{onClose}
>
	<div class="product-safety-alert-information">
		<p class="product-safety-alert-information__introduction">
			This information comes from the issuing agency. Check the current package
			and open the official notice for the complete instructions.
		</p>

		{#each alerts as alert}
			<article class="product-safety-alert-information__notice">
				<div class="product-safety-alert-information__heading">
					<h3>{alert.productDescription}</h3>
					{#if alert.classification}
						<span>{alert.classification}</span>
					{/if}
				</div>

				{#if alert.reason}
					<section>
						<h4>Why it was recalled</h4>
						<p>{alert.reason}</p>
					</section>
				{/if}

				{#if alert.requiresPackageCheck}
					<section>
						<h4>Check your package</h4>
						<p>
							The recall may apply only to certain packages, lots, or date
							codes. Match yours against the official notice before deciding
							what to do.
						</p>
					</section>
				{/if}

				{#if alert.packageDescription || alert.codeInformation}
					<dl class="product-safety-alert-information__package-details">
						{#if alert.packageDescription}
							<div>
								<dt>Package</dt>
								<dd>{alert.packageDescription}</dd>
							</div>
						{/if}
						{#if alert.codeInformation}
							<div>
								<dt>Codes to check</dt>
								<dd>{alert.codeInformation}</dd>
							</div>
						{/if}
					</dl>
				{/if}

				<dl class="product-safety-alert-information__metadata">
					{#if alert.recallingOrganization}
						<div>
							<dt>Recalled by</dt>
							<dd>{alert.recallingOrganization}</dd>
						</div>
					{/if}
					<div>
						<dt>Source</dt>
						<dd>{alert.sourceAttribution}</dd>
					</div>
					{#if alert.reportDate || alert.recallInitiatedAt}
						<div>
							<dt>{alert.reportDate ? "Reported" : "Recall started"}</dt>
							<dd>
								{formatOfficialNoticeDate(
									alert.reportDate ?? alert.recallInitiatedAt,
								)}
							</dd>
						</div>
					{/if}
				</dl>

				<RoundedActionLink
					href={alert.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					fullWidth
				>
					Read the official notice
				</RoundedActionLink>
			</article>
		{/each}

		<p class="product-safety-alert-information__disclaimer">
			Recall information is not medical advice. If anyone may be ill or injured,
			contact a qualified medical professional.
		</p>
		<ActionButton type="button" variant="ghost" fullWidth onclick={onClose}>
			Done
		</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ProductSafetyAlertInformationSheet.scss";
</style>
