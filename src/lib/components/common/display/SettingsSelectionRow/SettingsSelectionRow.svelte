<script lang="ts">
	import type { SettingsSelectionRowProps } from "./types";

	let {
		title,
		description,
		class: className = "",
		status,
		actions,
	}: SettingsSelectionRowProps = $props();
</script>

<div class={`settings-selection-row ${className}`.trim()}>
	<div class="settings-selection-row__content">
		<strong>{title}</strong>
		{#if description}
			<small>{description}</small>
		{/if}
	</div>
	{#if status}
		<div class="settings-selection-row__status">
			{@render status()}
		</div>
	{/if}
	{#if actions}
		<div class="settings-selection-row__actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./SettingsSelectionRow.scss";
</style>
