<script lang="ts">
	import { getNutrientRadarChartAxisOrder, NUTRIENT_RADAR_CHART_DEFAULTS } from "./config";
	import type { NutrientRadarChartProps } from "./types";

	let {
		nutrientAxisCount = 0,
		actualGoalRatios = [],
		targetGoalRatios = [],
		nutrientLabels = [],
		nutrientValueLabels = [],
		showValueLabels = true,
		nutrientAxisColors = [],
		chartSizePixels = NUTRIENT_RADAR_CHART_DEFAULTS.chartSizePixels,
		actualFillColor = NUTRIENT_RADAR_CHART_DEFAULTS.actualFillColor,
		actualStrokeColor = NUTRIENT_RADAR_CHART_DEFAULTS.actualStrokeColor,
		gridLineColor = NUTRIENT_RADAR_CHART_DEFAULTS.gridLineColor,
		targetOutlineColor = NUTRIENT_RADAR_CHART_DEFAULTS.targetOutlineColor,
		fullWidth = false,
		class: className = "",
	}: NutrientRadarChartProps = $props();

	const ringCount = NUTRIENT_RADAR_CHART_DEFAULTS.ringCount;
	const chartCenterCoordinate = $derived(chartSizePixels / 2);
	const chartRadiusPixels = $derived(chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.chartRadiusRatio);
	const labelRadiusPixels = $derived(chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.labelRadiusRatio);
	const normalizedNutrientAxisCount = $derived(Math.max(0, Math.floor(nutrientAxisCount)));
	const axisCount = $derived(normalizedNutrientAxisCount);
	const sourceIndexesByAxisPosition = $derived(getNutrientRadarChartAxisOrder(nutrientLabels, axisCount));
	const orderedNutrientLabels = $derived(
		sourceIndexesByAxisPosition.map((sourceIndex) => nutrientLabels[sourceIndex] ?? ""),
	);
	const orderedNutrientValueLabels = $derived(
		sourceIndexesByAxisPosition.map((sourceIndex) => nutrientValueLabels[sourceIndex] ?? ""),
	);
	const orderedActualGoalRatios = $derived(
		sourceIndexesByAxisPosition.map((sourceIndex) =>
			Math.max(0, Math.min(actualGoalRatios[sourceIndex] ?? 0, 1)),
		),
	);
	const orderedNutrientAxisColors = $derived(
		sourceIndexesByAxisPosition.map((sourceIndex) => ({
			fill: nutrientAxisColors[sourceIndex]?.fill ?? actualFillColor,
			stroke: nutrientAxisColors[sourceIndex]?.stroke ?? actualStrokeColor,
		})),
	);
	const hasChartData = $derived(normalizedNutrientAxisCount > 0);
	const accessibleNutrientSummary = $derived(
		Array.from({ length: axisCount }, (_value, index) => {
			const sourceIndex = sourceIndexesByAxisPosition[index] ?? index;
			const label = orderedNutrientLabels[index]?.trim() || `Axis ${sourceIndex + 1}`;
			const value = orderedNutrientValueLabels[index]?.trim();
			return value ? `${label}: ${value}` : label;
		}).join("; "),
	);

	const calculatePointOnAxis = (
		axisPosition: number,
		goalRatio = 1,
		radiusPixels = chartRadiusPixels,
	): [number, number] => {
		if (axisCount === 1) {
			return [chartCenterCoordinate, chartCenterCoordinate - radiusPixels * goalRatio];
		}

		if (axisCount === 2) {
			const direction = axisPosition === 0 ? -1 : 1;
			return [chartCenterCoordinate + radiusPixels * goalRatio * direction, chartCenterCoordinate];
		}

		const angle = (2 * Math.PI * axisPosition) / axisCount - Math.PI / 2;
		return [
			chartCenterCoordinate + radiusPixels * goalRatio * Math.cos(angle),
			chartCenterCoordinate + radiusPixels * goalRatio * Math.sin(angle),
		];
	};

	const serializeSvgPointList = (pointsList: [number, number][]) => {
		return pointsList
			.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
			.join(" ");
	};

	const gridRingPoints = $derived(
		Array.from({ length: ringCount }, (_, index) =>
			Array.from({ length: axisCount }, (_value, axisIndex) =>
				calculatePointOnAxis(axisIndex, (index + 1) / ringCount),
			),
		),
	);
	const nutrientAxisLineCoordinates = $derived(
		Array.from({ length: axisCount }, (_value, index) => ({
			end: calculatePointOnAxis(index),
			label: calculatePointOnAxis(index, 1, labelRadiusPixels),
		})),
	);

	const getSvgTextAnchor = (x: number) => {
		const centerThreshold =
			chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.centerAnchorThresholdRatio;
		if (x < chartCenterCoordinate - centerThreshold) return "end";
		if (x > chartCenterCoordinate + centerThreshold) return "start";
		return "middle";
	};
	const getConstrainedLabelX = (x: number) => {
		const horizontalInset =
			chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.labelHorizontalInsetRatio;
		return Math.max(horizontalInset, Math.min(x, chartSizePixels - horizontalInset));
	};
	const getConstrainedLabelY = (y: number) => {
		if (axisCount === 2) return chartCenterCoordinate - chartSizePixels * 0.11;

		const topInset = chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.labelVerticalInsetRatio;
		const bottomInset = chartSizePixels * NUTRIENT_RADAR_CHART_DEFAULTS.labelBottomInsetRatio;
		return Math.max(topInset, Math.min(y, chartSizePixels - bottomInset));
	};
	const getNutrientLabelAnchor = (x: number) => {
		return getSvgTextAnchor(x);
	};
	const splitNutrientLabelIntoLines = (label: string) => {
		const cleanLabel = label.trim();
		if (!cleanLabel) return [""];
		if (cleanLabel.length <= 11) return [cleanLabel];

		const words = cleanLabel.split(/\s+/);
		if (words.length === 1) {
			return [cleanLabel];
		}

		const lines = words.reduce<string[]>(
			(accumulator, word) => {
				const currentLine = accumulator[accumulator.length - 1] ?? "";
				const nextLine = `${currentLine} ${word}`.trim();

				if (!currentLine || nextLine.length <= 11) {
					accumulator[accumulator.length - 1] = nextLine;
					return accumulator;
				}

				accumulator.push(word);
				return accumulator;
			},
			[""],
		);

		return lines.slice(0, 2);
	};
	const actualNutrientPoints = $derived(
		Array.from({ length: axisCount }, (_value, index) =>
			calculatePointOnAxis(index, orderedActualGoalRatios[index]),
		),
	);
	const orderedTargetGoalRatios = $derived(
		sourceIndexesByAxisPosition.map((sourceIndex) =>
			Math.max(0, Math.min(targetGoalRatios[sourceIndex] ?? 1, 1)),
		),
	);
	const targetNutrientPoints = $derived(
		Array.from({ length: axisCount }, (_v, index) =>
			calculatePointOnAxis(index, orderedTargetGoalRatios[index]),
		),
	);
	const actualNutrientSegments = $derived(
		Array.from({ length: axisCount }, (_value, index) => {
			const nextIndex = (index + 1) % axisCount;
			return {
				id: `value-segment-${axisCount}-${index}`,
				fillId: `value-fill-${axisCount}-${index}`,
				start: actualNutrientPoints[index],
				end: actualNutrientPoints[nextIndex],
				startColor: orderedNutrientAxisColors[index],
				endColor: orderedNutrientAxisColors[nextIndex],
			};
		}),
	);
</script>

<svg
	class={`nutrient-radar-chart ${fullWidth ? "nutrient-radar-chart--full" : ""} ${className}`.trim()}
	width={chartSizePixels}
	height={chartSizePixels}
	viewBox={`0 0 ${chartSizePixels} ${chartSizePixels}`}
	role="img"
	aria-label={`${normalizedNutrientAxisCount}-axis nutrient radar chart${accessibleNutrientSummary ? `. ${accessibleNutrientSummary}` : ""}`}
>
	{#if hasChartData}
		<defs>
			{#each actualNutrientSegments as segment}
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
					cx={chartCenterCoordinate}
					cy={chartCenterCoordinate}
					r={chartRadiusPixels * ((index + 1) / ringCount)}
					fill="none"
					stroke={gridLineColor}
					stroke-width={chartSizePixels * 0.003}
				/>
			{/each}
			<line
				x1={chartCenterCoordinate}
				y1={chartCenterCoordinate}
				x2={chartCenterCoordinate}
				y2={chartCenterCoordinate - chartRadiusPixels}
				stroke={gridLineColor}
				stroke-width={chartSizePixels * 0.003}
			/>
			<circle
				class="nutrient-radar-chart__value-circle"
				cx={chartCenterCoordinate}
				cy={chartCenterCoordinate}
				r={chartRadiusPixels * orderedActualGoalRatios[0]}
				fill={orderedNutrientAxisColors[0].fill}
				stroke={orderedNutrientAxisColors[0].stroke}
				stroke-width={chartSizePixels * 0.007}
			/>
			<circle
				class="nutrient-radar-chart__goal-shape"
				cx={chartCenterCoordinate}
				cy={chartCenterCoordinate}
				r={chartRadiusPixels * orderedTargetGoalRatios[0]}
				fill="none"
				stroke={targetOutlineColor}
				stroke-width={chartSizePixels * 0.006}
				stroke-dasharray={NUTRIENT_RADAR_CHART_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
			/>
		{:else if axisCount === 2}
			{#each Array.from({ length: ringCount }) as _ring, index}
				<line
					x1={chartCenterCoordinate - chartRadiusPixels * ((index + 1) / ringCount)}
					y1={chartCenterCoordinate}
					x2={chartCenterCoordinate + chartRadiusPixels * ((index + 1) / ringCount)}
					y2={chartCenterCoordinate}
					stroke={gridLineColor}
					stroke-width={chartSizePixels * 0.003}
				/>
			{/each}
			<line
				x1={chartCenterCoordinate - chartRadiusPixels * orderedActualGoalRatios[0]}
				y1={chartCenterCoordinate}
				x2={chartCenterCoordinate + chartRadiusPixels * orderedActualGoalRatios[1]}
				y2={chartCenterCoordinate}
				stroke={`url(#${actualNutrientSegments[0].id})`}
				stroke-width={chartSizePixels * 0.03}
				stroke-linecap="round"
			/>
			<line
				class="nutrient-radar-chart__goal-shape"
				x1={chartCenterCoordinate - chartRadiusPixels * orderedTargetGoalRatios[0]}
				y1={chartCenterCoordinate}
				x2={chartCenterCoordinate + chartRadiusPixels * orderedTargetGoalRatios[1]}
				y2={chartCenterCoordinate}
				stroke={targetOutlineColor}
				stroke-width={chartSizePixels * 0.006}
				stroke-dasharray={NUTRIENT_RADAR_CHART_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
			/>
		{:else}
			{#each gridRingPoints as ringPoints}
				<polygon
					class="nutrient-radar-chart__ring"
					points={serializeSvgPointList(ringPoints)}
					fill="none"
					stroke={gridLineColor}
					stroke-width={chartSizePixels * 0.003}
				/>
			{/each}

			{#each nutrientAxisLineCoordinates as axis}
				<line
					class="nutrient-radar-chart__axis"
					x1={chartCenterCoordinate}
					y1={chartCenterCoordinate}
					x2={axis.end[0]}
					y2={axis.end[1]}
					stroke={gridLineColor}
					stroke-width={chartSizePixels * 0.003}
				/>
			{/each}

			<g class="nutrient-radar-chart__value-fill">
				{#each actualNutrientSegments as segment}
					<polygon
						points={serializeSvgPointList([
							[chartCenterCoordinate, chartCenterCoordinate],
							segment.start,
							segment.end,
						])}
						fill={`url(#${segment.fillId})`}
					/>
				{/each}
			</g>

			<g class="nutrient-radar-chart__value-stroke">
				{#each actualNutrientSegments as segment}
					<line
						x1={segment.start[0]}
						y1={segment.start[1]}
						x2={segment.end[0]}
						y2={segment.end[1]}
						stroke={`url(#${segment.id})`}
						stroke-width={chartSizePixels * 0.007}
						stroke-linecap="round"
					/>
				{/each}
			</g>

			<polygon
				class="nutrient-radar-chart__goal-shape"
				points={serializeSvgPointList(targetNutrientPoints)}
				fill="none"
				stroke={targetOutlineColor}
				stroke-width={chartSizePixels * 0.006}
				stroke-dasharray={NUTRIENT_RADAR_CHART_DEFAULTS.goalDashPattern}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/if}

		{#each nutrientAxisLineCoordinates as axis, index}
			{@const labelX = getConstrainedLabelX(axis.label[0])}
			{@const labelY = getConstrainedLabelY(axis.label[1])}
			{@const labelLines = splitNutrientLabelIntoLines(orderedNutrientLabels[index] ?? "")}
			<text
				class="nutrient-radar-chart__label"
				x={labelX}
				y={labelY}
				text-anchor={getNutrientLabelAnchor(axis.label[0])}
				dominant-baseline="middle"
			>
				{#each labelLines as labelLine, lineIndex}
					<tspan x={labelX} dy={lineIndex === 0 ? 0 : "1.1em"}>
						{labelLine}
					</tspan>
				{/each}
				{#if showValueLabels && orderedNutrientValueLabels[index]}
					<tspan class="nutrient-radar-chart__value-label" x={labelX} dy="1.2em">
						{orderedNutrientValueLabels[index]}
					</tspan>
				{/if}
			</text>
		{/each}
	{/if}
</svg>

<style lang="scss">
	@use "./NutrientRadarChart.scss";
</style>
