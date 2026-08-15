<script lang="ts">
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal/DotsHorizontal.svelte";
	import Save from "$lib/assets/icons/Save/Save.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import SecondaryDelightMessage from "$lib/components/common/feedback/SecondaryDelightMessage/SecondaryDelightMessage.svelte";
	import type { MixHeaderProps } from "./types";

	let {
		loadedName = null,
		delightMessage = null,
		isDirty = false,
		canSave,
		optionsOpen = false,
		onSave,
		onOpenOptions,
	}: MixHeaderProps = $props();
</script>

<header class="mix-header">
	<div class="mix-header__copy">
		<h1>Mix.</h1>
		{#if isDirty}
			<div class="mix-header__status">
				<MetadataPill label="Unsaved changes" tone="warning" />
			</div>
		{/if}
		{#if loadedName}
			<p>
				Fine-tune <strong>{loadedName}</strong> and make it work for you.
			</p>
		{:else}
			<p>
				Build something delicious and watch your nutrition goals take
				shape.
			</p>
		{/if}
		<SecondaryDelightMessage message={delightMessage} />
	</div>
	<div class="mix-header__actions">
		<CircleIconButton
			class="mix-header__action"
			label="Open mix options"
			variant={optionsOpen ? "primary" : "soft"}
			size="small"
			aria-expanded={optionsOpen}
			onclick={onOpenOptions}
		>
			<DotsHorizontal size={20} />
		</CircleIconButton>
		<CircleIconButton
			class="mix-header__action mix-header__save"
			label="Save mix"
			variant="primary"
			size="small"
			disabled={!canSave}
			onclick={onSave}
		>
			<Save size={17} />
		</CircleIconButton>
	</div>
</header>

<style lang="scss">
	@use "./MixHeader.scss";
</style>
