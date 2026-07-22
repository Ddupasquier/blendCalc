<script lang="ts">
	import { POINT_SHAPE_DEFAULTS } from "../../../../defaults/pointShapeDefaults";

	type PointColor = {
		fill: string;
		stroke: string;
	};

	interface Props {
		points?: number;
		values?: number[];
		goalValues?: number[];
		labels?: string[];
		valueLabels?: string[];
		pointColors?: PointColor[];
		size?: number;
		fillColor?: string;
		strokeColor?: string;
		gridColor?: string;
		goalColor?: string;
		goalFillColor?: string;
		goalStrokeColor?: string;
		fullWidth?: boolean;
		class?: string;
	}

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
		goalFillColor = POINT_SHAPE_DEFAULTS.goalFillColor,
		goalStrokeColor = POINT_SHAPE_DEFAULTS.goalStrokeColor,
		fullWidth = false,
		class: className = "",
	}: Props = $props();

	const ringCount = POINT_SHAPE_DEFAULTS.ringCount;
	const center = $derived(size / 2);
	const chartRadius = $derived(size * 0.3);
	const labelRadius = $derived(size * 0.43);
	const normalizedPoints = $derived(Math.max(0, Math.floor(points)));
	const axisCount = $derived(normalizedPoints);
	const normalizedValues = $derived(
		Array.from({ length: axisCount }, (_, index) =>
			Math.max(0, Math.min(values[index] ?? 0, 1)),
		),
	);
	const normalizedPointColors = $derived(
		Array.from({ length: axisCount }, (_value, index) => ({
			fill: pointColors[index]?.fill ?? fillColor,
			stroke: pointColors[index]?.stroke ?? strokeColor,
		})),
	);
	const hasData = $derived(normalizedPoints > 0);

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
		if (x < center - 4) return "start";
		if (x > center + 4) return "end";
		return "middle";
	};
	const getLabelX = (x: number) => {
		return Math.max(size * 0.08, Math.min(x, size * 0.92));
	};
	const getLabelY = (y: number) => {
		if (axisCount === 2) return center - size * 0.11;

		return Math.max(size * 0.1, Math.min(y, size * 0.86));
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
			return [cleanLabel.length > 13 ? `${cleanLabel.slice(0, 12)}…` : cleanLabel];
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
	const goalPoints = $derived(
		Array.from({ length: axisCount }, (_value, index) => pointAt(index)),
	);
	const valuePoints = $derived(
		Array.from({ length: axisCount }, (_value, index) =>
			pointAt(index, normalizedValues[index]),
		),
	);
	const normalizedGoalValues = $derived(
		Array.from({ length: axisCount }, (_, index) =>
			Math.max(0, Math.min(goalValues[index] ?? 1, 1)),
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
	aria-label={`${normalizedPoints}-axis nutrient radar chart`}
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
				cx={center}
				cy={center}
				r={chartRadius}
				fill="none"
				stroke={goalColor}
				stroke-width={size * 0.006}
			/>
			<circle
				class="point-shape__goal-shape"
				cx={center}
				cy={center}
				r={chartRadius * normalizedGoalValues[0]}
				fill={goalFillColor}
				stroke={goalStrokeColor}
				stroke-width={size * 0.005}
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
				x1={center - chartRadius}
				y1={center}
				x2={center + chartRadius}
				y2={center}
				stroke={goalColor}
				stroke-width={size * 0.006}
				stroke-linecap="round"
			/>
			<line
				class="point-shape__goal-shape"
				x1={center - chartRadius * normalizedGoalValues[0]}
				y1={center}
				x2={center + chartRadius * normalizedGoalValues[1]}
				y2={center}
				stroke={goalStrokeColor}
				stroke-width={size * 0.024}
				stroke-linecap="round"
				opacity="0.85"
			/>
			<line
				x1={center - chartRadius * normalizedValues[0]}
				y1={center}
				x2={center + chartRadius * normalizedValues[1]}
				y2={center}
				stroke={`url(#${valueSegments[0].id})`}
				stroke-width={size * 0.03}
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

			<polygon
				class="point-shape__goal-shape"
				points={pointsToString(goalValuePoints)}
				fill={goalFillColor}
				stroke={goalStrokeColor}
				stroke-width={size * 0.005}
			/>

			<polygon
				class="point-shape__goal"
				points={pointsToString(goalPoints)}
				fill="none"
				stroke={goalColor}
				stroke-width={size * 0.006}
			/>

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
		{/if}

		{#each axisLines as axis, index}
			{@const labelX = getLabelX(axis.label[0])}
			{@const labelY = getLabelY(axis.label[1])}
			{@const labelLines = getLabelLines(labels[index] ?? "")}
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
				{#if valueLabels[index]}
					<tspan
						class="point-shape__value-label"
						x={labelX}
						dy="1.2em"
					>
						{valueLabels[index]}
					</tspan>
				{/if}
			</text>
		{/each}
	{/if}
</svg>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.point-shape {
		display: block;
		overflow: hidden;
	}

	.point-shape--full {
		width: 100%;
		height: auto;
	}

	.point-shape__label {
		fill: $app-primary;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-semibold;
	}

	.point-shape__value-label {
		fill: $app-muted;
		font-family: $app-font-family-data;
		font-size: 0.62rem;
		font-weight: $app-font-weight-bold;
		font-variant-numeric: tabular-nums;
		letter-spacing: $app-letter-spacing-data;
	}

	.point-shape__value-circle {
		transition:
			r 0.32s ease-out,
			fill 0.18s ease,
			stroke 0.18s ease;
	}

	.point-shape__goal-shape {
		transition:
			r 0.32s ease-out,
			fill 0.18s ease,
			stroke 0.18s ease;
	}

	.point-shape__value-fill,
	.point-shape__value-stroke {
		transition:
			fill 0.18s ease,
			stroke 0.18s ease;
	}

	.point-shape__value-fill {
		opacity: 0.78;
	}
</style>
