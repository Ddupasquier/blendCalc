<script lang="ts">
	import Pencil from "$lib/assets/icons/Pencil/Pencil.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CustomBadge from "../CustomBadge/CustomBadge.svelte";
	import type { PillProps } from "./types";

	let {
		label,
		onRemove,
		onRename,
		onSelect,
		removable = true,
		active = false,
		custom = false,
		disabled = false,
	}: PillProps = $props();
</script>

<span
	class="pill {active ? 'active' : ''}"
	class:custom
	aria-disabled={disabled}
>
	{#if onSelect}
		<button
			class="pill-select"
			type="button"
			aria-pressed={active}
			disabled={disabled}
			onclick={onSelect}
		>
			<span class="pill-label" title={label}>{label}</span>
			{#if custom}<CustomBadge />{/if}
		</button>
	{:else}
		<span class="pill-content">
			<span class="pill-label" title={label}>{label}</span>
			{#if custom}<CustomBadge />{/if}
		</span>
	{/if}
	{#if onRename}
		<button
			class="pill-action pill-rename"
			aria-label={`Rename ${label}`}
			disabled={disabled}
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				if (!disabled) onRename();
			}}
		>
			<Pencil size={13} />
		</button>
	{/if}
	{#if removable && onRemove}
		<button
			class="pill-action pill-remove"
			aria-label={`Remove ${label}`}
			disabled={disabled}
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				if (!disabled) onRemove();
			}}
		>
			<X size={13} />
		</button>
	{/if}
</span>

<style lang="scss">
	@use "./Pill.scss";
</style>
