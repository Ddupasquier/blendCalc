<script lang="ts">
	import { untrack } from "svelte";
	import { enhance } from "$app/forms";
	import PrivilegedActionGroup from "$lib/components/common/actions/PrivilegedActionGroup/PrivilegedActionGroup.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { ImagePlacementReviewEditorProps } from "./types";
	let {
		image,
		disabled = false,
		onBusyChange,
	}: ImagePlacementReviewEditorProps = $props();
	let draft = $state(untrack(() => ({ ...image.placement })));
	let busy = $state(false);
</script>

<PrivilegedActionGroup title="Shared image adjustment" showHeader={false}>
	<form
		class="image-placement-review-editor"
		method="POST"
		action="?/review"
		use:enhance={({ cancel }) => {
			if (busy || disabled) {
				cancel();
				return;
			}
			busy = true;
			onBusyChange?.(true);
			return async ({ update }) => {
				try {
					await update();
				} finally {
					busy = false;
					onBusyChange?.(false);
				}
			};
		}}
	>
		<input type="hidden" name="action" value="publish" />
		<input type="hidden" name="imageId" value={image.id} />
		<input type="hidden" name="imageUrl" value={image.imageUrl} />
		<input type="hidden" name="revision" value={image.revision} />
		<input type="hidden" name="placement" value={JSON.stringify(draft)} />
		<ImagePlacementEditor
			imageUrl={image.imageUrl}
			alt={`Shared image for ${image.name}`}
			foodName={image.name}
			value={draft}
			editable={!busy && !disabled}
			onChange={(value) => (draft = value)}
		/>
		<RoundedActionButton
			type="submit"
			variant="primary"
			fullWidth
			{busy}
			{disabled}>Publish shared placement</RoundedActionButton
		>
	</form>
</PrivilegedActionGroup>

<style lang="scss">
	@use "./ImagePlacementReviewEditor.scss";
</style>
