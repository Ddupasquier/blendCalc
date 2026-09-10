<script lang="ts">
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import type { PrivilegedWorkspaceGuideProps } from "./types";

	let {
		tone,
		title,
		description,
		completion,
		count = undefined,
		countLabel = "items requiring attention",
	}: PrivilegedWorkspaceGuideProps = $props();

	const stateLabel = $derived(
		tone === "clear"
			? "All clear"
			: tone === "lookup"
				? "Use when needed"
				: tone === "unavailable"
					? "Status unavailable"
					: "Start here",
	);
</script>

<section
	class="privileged-workspace-guide"
	data-tone={tone}
	aria-labelledby="privileged-workspace-guide-title"
>
	<header>
		<span class="privileged-workspace-guide__eyebrow">{stateLabel}</span>
		{#if typeof count === "number" && count > 0}
			<ActionRequiredCountBadge {count} label={countLabel} />
		{:else}
			<TextBadge
				label={tone === "unavailable"
					? "Unknown"
					: tone === "clear"
						? "0 waiting"
						: "On demand"}
				tone={tone === "clear"
					? "success"
					: tone === "unavailable"
						? "warning"
						: "info"}
			/>
		{/if}
	</header>
	<h2 id="privileged-workspace-guide-title">{title}</h2>
	<p>{description}</p>
	<p class="privileged-workspace-guide__completion">
		<strong>Done when</strong>
		<span>{completion}</span>
	</p>
</section>

<style lang="scss">
	@use "./PrivilegedWorkspaceGuide.scss";
</style>
