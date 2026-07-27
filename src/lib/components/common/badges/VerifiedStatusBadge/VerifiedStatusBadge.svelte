<script lang="ts">
	import ShieldCheck from "$lib/assets/icons/ShieldCheck/ShieldCheck.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte";
	import type { VerifiedStatusBadgeProps } from "./types";

	let {
		label,
		class: className = "",
	}: VerifiedStatusBadgeProps = $props();
</script>

<StatusIconBadge
	class={`verified-status-badge ${className}`.trim()}
	label={`Verification status: ${label}`}
	title={label}
	tone="success"
>
	<ShieldCheck />
</StatusIconBadge>

<style lang="scss">
	@use "./VerifiedStatusBadge.scss";
</style>
