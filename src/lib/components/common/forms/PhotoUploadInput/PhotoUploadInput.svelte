<script lang="ts">
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import type { PhotoUploadInputProps } from "./types";

	let {
		id,
		name,
		prompt,
		description,
		photoCount = 1,
		files = undefined,
		accept = "image/jpeg,image/png,image/webp",
		capture = undefined,
		required = false,
		disabled = false,
		onFilesChange,
	}: PhotoUploadInputProps = $props();

	let input = $state<HTMLInputElement | null>(null);
	let localFiles = $state<File[]>([]);
	let error = $state("");

	const allowedPhotoCount = $derived(Math.max(1, Math.floor(photoCount)));
	const selectedFiles = $derived(files ?? localFiles);
	const titleId = $derived(`${id}-title`);
	const descriptionId = $derived(`${id}-description`);
	const statusId = $derived(`${id}-status`);
	const errorId = $derived(`${id}-error`);
	const describedBy = $derived(
		`${descriptionId} ${statusId}${error ? ` ${errorId}` : ""}`,
	);
	const countLabel = $derived(
		allowedPhotoCount === 1 ? "1 photo" : `Up to ${allowedPhotoCount} photos`,
	);
	const selectionLabel = $derived.by(() => {
		if (selectedFiles.length === 0) {
			return allowedPhotoCount === 1
				? "No photo selected"
				: "No photos selected";
		}
		if (allowedPhotoCount === 1) return selectedFiles[0]?.name ?? "1 photo selected";
		return `${selectedFiles.length} of ${allowedPhotoCount} photos selected`;
	});

	const updateFiles = (nextFiles: File[]) => {
		localFiles = nextFiles;
		onFilesChange?.(nextFiles);
	};

	const handleSelection = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement;
		const nextFiles = Array.from(target.files ?? []);
		if (nextFiles.length > allowedPhotoCount) {
			target.value = "";
			error = `Choose no more than ${allowedPhotoCount} photos.`;
			updateFiles([]);
			return;
		}
		error = "";
		updateFiles(nextFiles);
	};

	const clearSelection = () => {
		if (input) input.value = "";
		error = "";
		updateFiles([]);
	};

	$effect(() => {
		if (files?.length === 0 && input?.value) input.value = "";
	});
</script>

<div class="photo-upload-input">
	<div class="photo-upload-input__heading">
		<strong id={titleId}>{prompt}</strong>
		<span>{required ? "required" : "optional"} · {countLabel}</span>
	</div>
	<p id={descriptionId}>{description}</p>

	<div class="photo-upload-input__control">
		<input
			bind:this={input}
			{id}
			{name}
			class="photo-upload-input__native"
			type="file"
			{accept}
			{capture}
			multiple={allowedPhotoCount > 1}
			{required}
			{disabled}
			aria-labelledby={titleId}
			aria-describedby={describedBy}
			aria-invalid={error ? "true" : undefined}
			onchange={handleSelection}
		/>
		<label class="photo-upload-input__trigger" for={id}>
			<Plus size={18} />
			<span>
				{selectedFiles.length > 0
					? allowedPhotoCount === 1
						? "Replace photo"
						: "Replace photos"
					: allowedPhotoCount === 1
						? "Choose photo"
						: "Choose photos"}
			</span>
		</label>
	</div>

	<div class="photo-upload-input__selection">
		<p id={statusId} aria-live="polite">{selectionLabel}</p>
		{#if selectedFiles.length > 0}
			<PillButton
				ariaLabel={`Clear ${prompt.toLowerCase()} selection`}
				disabled={disabled}
				onclick={clearSelection}
			>
				Clear
			</PillButton>
		{/if}
	</div>

	{#if selectedFiles.length > 1}
		<ul class="photo-upload-input__files" aria-label="Selected photos">
			{#each selectedFiles as file}
				<li>{file.name}</li>
			{/each}
		</ul>
	{/if}

	{#if error}
		<p class="photo-upload-input__error" id={errorId} role="alert">{error}</p>
	{/if}
</div>

<style lang="scss">
	@use "./PhotoUploadInput.scss";
</style>
