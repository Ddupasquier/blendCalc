<script lang="ts">
	import { flip } from "svelte/animate";
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import GripVertical from "$lib/assets/icons/GripVertical/GripVertical.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";
	import { MOTION_EASING_FUNCTION } from "$lib/utils/animation/transitions";
	import {
		getMixSectionLabel,
		isMixSectionId,
		moveMixSection,
		moveMixSectionRelative,
		normalizeMixSectionOrder,
		type MixSectionId,
	} from "$lib/utils/mix/ui/mixSectionOrder";
	import type {
		MixSectionDragPosition,
		MixSectionDragTarget,
		MixSectionOrganizerProps,
	} from "./types";

	let {
		order,
		busy = false,
		error = "",
		onOrderChange,
		onOrderCommit,
		onDone,
	}: MixSectionOrganizerProps = $props();

	// svelte-ignore state_referenced_locally -- the effect below keeps the controlled draft synchronized after initialization
	let draftOrder = $state<MixSectionId[]>(normalizeMixSectionOrder(order));
	let draggedSectionId = $state<MixSectionId | null>(null);
	let activePointerId = $state<number | null>(null);
	let dragPosition = $state<MixSectionDragPosition | null>(null);
	let announcement = $state("");
	let organizerElement: HTMLElement;
	let listElement: HTMLOListElement;

	$effect(() => {
		if (draggedSectionId === null) {
			draftOrder = normalizeMixSectionOrder(order);
		}
	});

	const announcePosition = (sectionId: MixSectionId) => {
		announcement = `${getMixSectionLabel(sectionId)} moved to position ${draftOrder.indexOf(sectionId) + 1} of ${draftOrder.length}.`;
	};

	const updateDraft = (nextOrder: MixSectionId[], sectionId: MixSectionId) => {
		if (nextOrder.every((id, index) => id === draftOrder[index])) return false;
		draftOrder = nextOrder;
		onOrderChange([...nextOrder]);
		announcePosition(sectionId);
		return true;
	};

	const commitDraft = () => onOrderCommit([...draftOrder]);

	const moveBy = (sectionId: MixSectionId, offset: number) => {
		const currentIndex = draftOrder.indexOf(sectionId);
		if (currentIndex < 0) return;
		const nextOrder = moveMixSection(
			draftOrder,
			sectionId,
			currentIndex + offset,
		);
		if (updateDraft(nextOrder, sectionId)) commitDraft();
	};

	const moveTo = (sectionId: MixSectionId, targetIndex: number) => {
		const nextOrder = moveMixSection(draftOrder, sectionId, targetIndex);
		if (updateDraft(nextOrder, sectionId)) commitDraft();
	};

	const handleDragKeydown = (event: KeyboardEvent, sectionId: MixSectionId) => {
		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveBy(sectionId, -1);
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveBy(sectionId, 1);
		}
		if (event.key === "Home") {
			event.preventDefault();
			moveTo(sectionId, 0);
		}
		if (event.key === "End") {
			event.preventDefault();
			moveTo(sectionId, draftOrder.length - 1);
		}
	};

	const handlePointerDown = (event: PointerEvent, sectionId: MixSectionId) => {
		if (event.button !== 0 || busy) return;
		const item = (event.currentTarget as HTMLElement).closest(
			"[data-mix-section-id]",
		);
		if (!(item instanceof HTMLElement)) return;
		const bounds = item.getBoundingClientRect();
		event.preventDefault();
		dragPosition = {
			top: bounds.top,
			left: bounds.left,
			width: bounds.width,
			height: bounds.height,
			pointerOffsetY: event.clientY - bounds.top,
		};
		draggedSectionId = sectionId;
		activePointerId = event.pointerId;
		organizerElement.setPointerCapture(event.pointerId);
	};

	const getClosestDragTarget = (dragCenterY: number) => {
		if (draggedSectionId === null) return null;

		const items = Array.from(
			listElement.querySelectorAll<HTMLElement>("[data-mix-section-id]"),
		);
		let closestTarget: MixSectionDragTarget | null = null;

		for (const item of items) {
			const sectionId = item.dataset.mixSectionId;
			if (!isMixSectionId(sectionId) || sectionId === draggedSectionId) continue;
			const bounds = item.getBoundingClientRect();
			const distance = Math.abs(
				dragCenterY - (bounds.top + bounds.height / 2),
			);

			if (closestTarget === null || distance < closestTarget.distance) {
				closestTarget = { sectionId, bounds, distance };
			}
		}

		return closestTarget;
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (
			draggedSectionId === null ||
			dragPosition === null ||
			event.pointerId !== activePointerId
		) {
			return;
		}
		event.preventDefault();
		const nextTop = event.clientY - dragPosition.pointerOffsetY;
		const dragCenterY = nextTop + dragPosition.height / 2;
		dragPosition = { ...dragPosition, top: nextTop };
		const target = getClosestDragTarget(dragCenterY);
		if (!target) return;

		const placeAfter =
			dragCenterY > target.bounds.top + target.bounds.height / 2;
		updateDraft(
			moveMixSectionRelative(
				draftOrder,
				draggedSectionId,
				target.sectionId,
				placeAfter,
			),
			draggedSectionId,
		);
	};

	const finishPointerDrag = (event: PointerEvent) => {
		if (draggedSectionId === null || event.pointerId !== activePointerId) return;
		const pointerId = activePointerId;
		draggedSectionId = null;
		activePointerId = null;
		dragPosition = null;
		if (organizerElement.hasPointerCapture(pointerId)) {
			organizerElement.releasePointerCapture(pointerId);
		}
		commitDraft();
	};
</script>

<section
	bind:this={organizerElement}
	class="mix-section-organizer"
	class:mix-section-organizer--dragging={draggedSectionId !== null}
	aria-labelledby="mix-section-organizer-title"
	onpointermove={handlePointerMove}
	onpointerup={finishPointerDrag}
	onpointercancel={finishPointerDrag}
	onlostpointercapture={finishPointerDrag}
>
	<div class="mix-section-organizer__header">
		<div class="mix-section-organizer__copy">
			<h2 id="mix-section-organizer-title">Reorganize sections</h2>
			<p id="mix-section-organizer-instructions">
				Drag the headers into place, or use the arrow controls. Your Mix will
				follow this order.
			</p>
		</div>
		<RoundedActionButton busy={busy} onclick={onDone}>Done</RoundedActionButton>
	</div>

	{#if error}
		<StatusMessage tone="danger" title="Your layout was not saved">
			{error}
		</StatusMessage>
	{/if}

	<ol
		bind:this={listElement}
		class="mix-section-organizer__list"
		aria-describedby="mix-section-organizer-instructions"
	>
		{#each draftOrder as sectionId, index (sectionId)}
			<li
				class="mix-section-organizer__slot"
				class:mix-section-organizer__slot--dragging={draggedSectionId === sectionId}
				class:mix-section-organizer__slot--displacing={draggedSectionId !== null &&
					draggedSectionId !== sectionId}
				data-mix-section-id={sectionId}
				style:height={draggedSectionId === sectionId && dragPosition
					? `${dragPosition.height}px`
					: undefined}
				animate:flip={{
					duration: getMotionSafeDuration(MOTION_DURATION_MS.layout),
					easing: MOTION_EASING_FUNCTION.spatial,
				}}
			>
				<div
					class="mix-section-organizer__item"
					class:mix-section-organizer__item--placeholder={draggedSectionId ===
						sectionId}
				>
					<CircleIconButton
						class="mix-section-organizer__drag-handle"
						label={`Drag ${getMixSectionLabel(sectionId)} to reorder`}
						variant="ghost"
						size="small"
						disabled={busy}
						onkeydown={(event) => handleDragKeydown(event, sectionId)}
						onpointerdown={(event) => handlePointerDown(event, sectionId)}
					>
						<GripVertical size={18} />
					</CircleIconButton>
					<span class="mix-section-organizer__label">
						{getMixSectionLabel(sectionId)}
					</span>
					<div class="mix-section-organizer__actions">
						<CircleIconButton
							label={`Move ${getMixSectionLabel(sectionId)} up`}
							variant="ghost"
							size="small"
							disabled={index === 0 || busy}
							onclick={() => moveBy(sectionId, -1)}
						>
							<Chevron direction="up" size={15} />
						</CircleIconButton>
						<CircleIconButton
							label={`Move ${getMixSectionLabel(sectionId)} down`}
							variant="ghost"
							size="small"
							disabled={index === draftOrder.length - 1 || busy}
							onclick={() => moveBy(sectionId, 1)}
						>
							<Chevron direction="down" size={15} />
						</CircleIconButton>
					</div>
				</div>
			</li>
		{/each}
	</ol>

	{#if draggedSectionId !== null && dragPosition !== null}
		<div
			class="mix-section-organizer__item mix-section-organizer__item--dragging"
			data-mix-drag-preview={draggedSectionId}
			style:top={`${dragPosition.top}px`}
			style:left={`${dragPosition.left}px`}
			style:width={`${dragPosition.width}px`}
			style:height={`${dragPosition.height}px`}
			inert
			aria-hidden="true"
		>
			<CircleIconButton
				class="mix-section-organizer__drag-handle"
				label={`Drag ${getMixSectionLabel(draggedSectionId)} to reorder`}
				variant="ghost"
				size="small"
			>
				<GripVertical size={18} />
			</CircleIconButton>
			<span class="mix-section-organizer__label">
				{getMixSectionLabel(draggedSectionId)}
			</span>
			<div class="mix-section-organizer__actions">
				<CircleIconButton
					label={`Move ${getMixSectionLabel(draggedSectionId)} up`}
					variant="ghost"
					size="small"
				>
					<Chevron direction="up" size={15} />
				</CircleIconButton>
				<CircleIconButton
					label={`Move ${getMixSectionLabel(draggedSectionId)} down`}
					variant="ghost"
					size="small"
				>
					<Chevron direction="down" size={15} />
				</CircleIconButton>
			</div>
		</div>
	{/if}

	<p class="visually-hidden" aria-live="polite">{announcement}</p>
</section>

<style lang="scss">
	@use "./MixSectionOrganizer.scss";
</style>
