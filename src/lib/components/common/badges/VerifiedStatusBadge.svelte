<script lang="ts">
	import ShieldCheck from "$lib/assets/icons/ShieldCheck.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
	import type { VerifiedStatusBadgeProps } from "$lib/components/common/badges/types";

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
