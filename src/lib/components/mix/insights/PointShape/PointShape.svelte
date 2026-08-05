<script lang="ts">
	import { getPointShapeAxisOrder, POINT_SHAPE_DEFAULTS } from "./config";
	import type { PointShapeProps } from "./types";

	let {
		points = 0,
		values = [],
		goalValues = [],
		labels = [],
		valueLabels = [],
		pointColors = [],
		size = POINT_SHAPE_DEFAULTS.size,
		fillColor = POINT_SHAPE_DEFAULTS.fillColor,
		strokeColor = POINT_SHAPE_DEFAULTS.strokeColor,
		gridColor = POINT_SHAPE_DEFAULTS.gridColor,
		goalColor = POINT_SHAPE_DEFAULTS.goalColor,
		fullWidth = false,
		class: className = "",
	}: PointShapeProps = $props();

	const ringCount = POINT_SHAPE_DEFAULTS.ringCount;
	const center = $derived(size / 2);
	const chartRadius = $derived(size * POINT_SHAPE_DEFAULTS.chartRadiusRatio);
	const labelRadius = $derived(size * POINT_SHAPE_DEFAULTS.labelRadiusRatio);
	const normalizedPoints = $derived(Math.max(0, Math.floor(points)));
	const axisCount = $derived(normalizedPoints);
	const axisOrder = $derived(getPointShapeAxisOrder(labels, axisCount));
	const displayLabels = $derived(
		axisOrder.map((sourceIndex) => labels[sourceIndex] ?? ""),
	);
	const displayValueLabels = $derived(
		axisOrder.map((sourceIndex) => valueLabels[sourceIndex] ?? ""),
	);
	const normalizedValues = $derived(
		axisOrder.map((sourceIndex) =>
			Math.max(0, Math.min(values[sourceIndex] ?? 0, 1)),
		),
	);
	const normalizedPointColors = $derived(
		axisOrder.map((sourceIndex) => ({
			fill: pointColors[sourceIndex]?.fill ?? fillColor,
			stroke: pointColors[sourceIndex]?.stroke ?? strokeColor,
		})),
	);
	const hasData = $derived(normalizedPoints > 0);
	const accessibleSummary = $derived(
		Array.from({ length: axisCount }, (_value, index) => {
			const sourceIndex = axisOrder[index] ?? index;
			const label = displayLabels[index]?.trim() || `Axis ${sourceIndex + 1}`;
			const value = displayValueLabels[index]?.trim();
			return value ? `${label}: ${value}` : label;
		}).join("; "),
	);

	const pointAt = (
		index: number,
		scale = 1,
		radius = chartRadius,
	): [number, number] => {
		if (axisCount === 1) {
			return [center, center - radius * scale];
		}

		if (axisCount === 2) {
			const direction = index === 0 ? -1 : 1;
			return [center + radius * scale * direction, center];
		}

		const angle = (2 * Math.PI * index) / axisCount - Math.PI / 2;
		return [
			center + radius * scale * Math.cos(angle),
			center + radius * scale * Math.sin(angle),
		];
	};

	const pointsToString = (pointsList: [number, number][]) => {
		return pointsList
			.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
			.join(" ");
	};

	const rings = $derived(
		Array.from({ length: ringCount }, (_, index) =>
			Array.from({ length: axisCount }, (_value, axisIndex) =>
				pointAt(axisIndex, (index + 1) / ringCount),
			),
		),
	);
	const axisLines = $derived(
		Array.from({ length: axisCount }, (_value, index) => ({
			end: pointAt(index),
			label: pointAt(index, 1, labelRadius),
		})),
	);

	const getTextAnchor = (x: number) => {
		const centerThreshold = size * POINT_SHAPE_DEFAULTS.centerAnchorThresholdRatio;
		if (x < center - centerThreshold) return "end";
		if (x > center + centerThreshold) return "start";
		return "middle";
	};
	const getLabelX = (x: number) => {
		const horizontalInset = size * POINT_SHAPE_DEFAULTS.labelHorizontalInsetRatio;
		return Math.max(horizontalInset, Math.min(x, size - horizontalInset));
	};
	const getLabelY = (y: number) => {
		if (axisCount === 2) return center - size * 0.11;

		const topInset = size * POINT_SHAPE_DEFAULTS.labelVerticalInsetRatio;
		const bottomInset = size * POINT_SHAPE_DEFAULTS.labelBottomInsetRatio;
		return Math.max(topInset, Math.min(y, size - bottomInset));
	};
	const getLabelAnchor = (x: number) => {
		return getTextAnchor(x);
	};
	const getLabelLines = (label: string) => {
		const cleanLabel = label.trim();
		if (!cleanLabel) return [""];
		if (cleanLabel.length <= 11) return [cleanLabel];

		const words = cleanLabel.split(/\s+/);
		if (words.length === 1) {
			return [cleanLabel];
		}

		const lines = words.reduce<string[]>((accumulator, word) => {
			const currentLine = accumulator[accumulator.length - 1] ?? "";
			const nextLine = `${currentLine} ${word}`.trim();

			if (!currentLine || nextLine.length <= 11) {
				accumulator[accumulator.length - 1] = nextLine;
				return accumulator;
			}

			accumulator.push(word);
			return accumulator;
		}, [""]);

		return lines.slice(0, 2);
	};
	const valuePoints = $derived(
		Array.from({ length: axisCount }, (_value, index) =>
			pointAt(index, normalizedValues[index]),
		),
	);
	const normalizedGoalValues = $derived(
		axisOrder.map((sourceIndex) =>
			Math.max(0, Math.min(goalValues[sourceIndex] ?? 1, 1)),
		),
	);
	const goalValuePoints = $derived(
		Array.from({ length: axisCount }, (_v, index) =>
			pointAt(index, normalizedGoalValues[index]),
		),
	);
	const valueSegments = $derived(
		Array.from({ length: axisCount }, (_value, index) => {
			const nextIndex = (index + 1) % axisCount;
			return {
				id: `value-segment-${axisCount}-${index}`,
				fillId: `value-fill-${axisCount}-${index}`,
				start: valuePoints[index],
				end: valuePoints[nextIndex],
				startColor: normalizedPointColors[index],
				endColor: normalizedPointColors[nextIndex],
			};
		}),
	);
</script>

<svg
	class={`point-shape ${fullWidth ? "point-shape--full" : ""} ${className}`.trim()}
	width={size}
	height={size}
	viewBox={`0 0 ${size} ${size}`}
	role="img"
	aria-label={`${normalizedPoints}-axis nutrient radar chart${accessibleSummary ? `. ${accessibleSummary}` : ""}`}
>
	{#if hasData}
		<defs>
			{#each valueSegments as segment}
				<linearGradient
					id={segment.id}
					gradientUnits="userSpaceOnUse"
					x1={segment.start[0]}
					y1={segment.start[1]}
					x2={segment.end[0]}
					y2={segment.end[1]}
				>
					<stop offset="0%" stop-color={segment.startColor.stroke} />
					<stop offset="100%" stop-color={segment.endColor.stroke} />
				</linearGradient>
				<linearGradient
					id={segment.fillId}
					gradientUnits="userSpaceOnUse"
					x1={segment.start[0]}
					y1={segment.start[1]}
					x2={segment.end[0]}
					y2={segment.end[1]}
				>
					<stop offset="0%" stop-color={segment.startColor.fill} />
					<stop offset="100%" stop-color={segment.endColor.fill} />
				</linearGradient>
			{/each}
		</defs>

		{#if axisCount === 1}
			{#each Array.from({ length: ringCount }) as _ring, index}
				<circle
					cx={center}
					cy={center}
					r={chartRadius * ((index + 1) / ringCount)}
					fill="none"
					stroke={gridColor}
					stroke-width={size * 0.003}
				/>
			{/each}
			<line
				x1={center}
				y1={center}
				x2={center}
				y2={center - chartRadius}
				stroke={gridColor}
				stroke-width={size * 0.003}
			/>
			<circle
				class="point-shape__value-circle"
				cx={center}
				cy={center}
				r={chartRadius * normalizedValues[0]}
				fill={normalizedPointColors[0].fill}
				stroke={normalizedPointColors[0].stroke}
				stroke-width={size * 0.007}
			/>
			<circle
				class="point-shape__goal-shape"
				cx={center}
				cy={center}
				r={chartRadius * normalizedGoalValues[0]}
				fill="none"
				stroke={goalColor}
				stroke-width={size * 0.006}
				stroke-dasharray={POINT_SHAPE_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
			/>
		{:else if axisCount === 2}
			{#each Array.from({ length: ringCount }) as _ring, index}
				<line
					x1={center - chartRadius * ((index + 1) / ringCount)}
					y1={center}
					x2={center + chartRadius * ((index + 1) / ringCount)}
					y2={center}
					stroke={gridColor}
					stroke-width={size * 0.003}
				/>
			{/each}
			<line
				x1={center - chartRadius * normalizedValues[0]}
				y1={center}
				x2={center + chartRadius * normalizedValues[1]}
				y2={center}
				stroke={`url(#${valueSegments[0].id})`}
				stroke-width={size * 0.03}
				stroke-linecap="round"
			/>
			<line
				class="point-shape__goal-shape"
				x1={center - chartRadius * normalizedGoalValues[0]}
				y1={center}
				x2={center + chartRadius * normalizedGoalValues[1]}
				y2={center}
				stroke={goalColor}
				stroke-width={size * 0.006}
				stroke-dasharray={POINT_SHAPE_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
			/>
		{:else}
			{#each rings as ring}
				<polygon
					class="point-shape__ring"
					points={pointsToString(ring)}
					fill="none"
					stroke={gridColor}
					stroke-width={size * 0.003}
				/>
			{/each}

			{#each axisLines as axis}
				<line
					class="point-shape__axis"
					x1={center}
					y1={center}
					x2={axis.end[0]}
					y2={axis.end[1]}
					stroke={gridColor}
					stroke-width={size * 0.003}
				/>
			{/each}

			<g class="point-shape__value-fill">
				{#each valueSegments as segment}
					<polygon
						points={pointsToString([[center, center], segment.start, segment.end])}
						fill={`url(#${segment.fillId})`}
					/>
				{/each}
			</g>

			<g class="point-shape__value-stroke">
				{#each valueSegments as segment}
					<line
						x1={segment.start[0]}
						y1={segment.start[1]}
						x2={segment.end[0]}
						y2={segment.end[1]}
						stroke={`url(#${segment.id})`}
						stroke-width={size * 0.007}
						stroke-linecap="round"
					/>
				{/each}
			</g>

			<polygon
				class="point-shape__goal-shape"
				points={pointsToString(goalValuePoints)}
				fill="none"
				stroke={goalColor}
				stroke-width={size * 0.006}
				stroke-dasharray={POINT_SHAPE_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/if}

		{#each axisLines as axis, index}
			{@const labelX = getLabelX(axis.label[0])}
			{@const labelY = getLabelY(axis.label[1])}
			{@const labelLines = getLabelLines(displayLabels[index] ?? "")}
			<text
				class="point-shape__label"
				x={labelX}
				y={labelY}
				text-anchor={getLabelAnchor(axis.label[0])}
				dominant-baseline="middle"
			>
				{#each labelLines as labelLine, lineIndex}
					<tspan x={labelX} dy={lineIndex === 0 ? 0 : "1.1em"}>
						{labelLine}
					</tspan>
				{/each}
				{#if displayValueLabels[index]}
					<tspan
						class="point-shape__value-label"
						x={labelX}
						dy="1.2em"
					>
						{displayValueLabels[index]}
					</tspan>
				{/if}
			</text>
		{/each}
	{/if}
</svg>

<style lang="scss">
	@use "./PointShape.scss";
</style>
