import type {
  TutorialCornerRadii,
  TutorialCornerRadius,
  TutorialPosition,
  TutorialRect,
  TutorialSize,
  TutorialViewport,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export const TUTORIAL_SPOTLIGHT_GAP_REM = 0.5;

export const getTutorialSpotlightGap = (rootFontSize: number) => {
  return Math.max(0, rootFontSize) * TUTORIAL_SPOTLIGHT_GAP_REM;
};

export const getTutorialSpotlightRect = (
  target: TutorialRect,
  viewport: TutorialViewport,
  padding = 8,
  margin = 8,
  bounds?: TutorialRect,
): TutorialRect => {
  const minimumTop = Math.max(margin, bounds?.top ?? margin);
  const minimumLeft = Math.max(margin, bounds?.left ?? margin);
  const maximumRight = Math.min(
    viewport.width - margin,
    bounds?.right ?? viewport.width - margin,
  );
  const maximumBottom = Math.min(
    viewport.height - margin,
    bounds?.bottom ?? viewport.height - margin,
  );
  const top = clamp(target.top - padding, minimumTop, maximumBottom);
  const left = clamp(target.left - padding, minimumLeft, maximumRight);
  const right = clamp(target.right + padding, left, maximumRight);
  const bottom = clamp(target.bottom + padding, top, maximumBottom);

  return {
    top,
    right,
    bottom,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const parseRadiusValue = (value: string, axisSize: number) => {
  const parsedValue = Number.parseFloat(value);
  if (!Number.isFinite(parsedValue)) return 0;
  return value.endsWith("%") ? (axisSize * parsedValue) / 100 : parsedValue;
};

export const parseTutorialCornerRadius = (
  value: string,
  target: TutorialSize,
): TutorialCornerRadius => {
  const [horizontalValue = "0", verticalValue = horizontalValue] = value
    .trim()
    .split(/\s+/);

  return {
    horizontal: Math.max(0, parseRadiusValue(horizontalValue, target.width)),
    vertical: Math.max(0, parseRadiusValue(verticalValue, target.height)),
  };
};

export const getTutorialSpotlightRadii = (
  targetRadii: TutorialCornerRadii,
  target: TutorialRect,
  spotlight: TutorialRect,
): TutorialCornerRadii => {
  const leftExpansion = Math.max(0, target.left - spotlight.left);
  const rightExpansion = Math.max(0, spotlight.right - target.right);
  const topExpansion = Math.max(0, target.top - spotlight.top);
  const bottomExpansion = Math.max(0, spotlight.bottom - target.bottom);
  const maximumHorizontal = spotlight.width / 2;
  const maximumVertical = spotlight.height / 2;
  const expandRadius = (
    radius: TutorialCornerRadius,
    horizontalExpansion: number,
    verticalExpansion: number,
  ): TutorialCornerRadius => ({
    horizontal: clamp(
      radius.horizontal + horizontalExpansion,
      0,
      maximumHorizontal,
    ),
    vertical: clamp(radius.vertical + verticalExpansion, 0, maximumVertical),
  });

  return {
    topLeft: expandRadius(targetRadii.topLeft, leftExpansion, topExpansion),
    topRight: expandRadius(targetRadii.topRight, rightExpansion, topExpansion),
    bottomRight: expandRadius(
      targetRadii.bottomRight,
      rightExpansion,
      bottomExpansion,
    ),
    bottomLeft: expandRadius(
      targetRadii.bottomLeft,
      leftExpansion,
      bottomExpansion,
    ),
  };
};

const formatGeometryValue = (value: number) => {
  return Number(value.toFixed(3));
};

export const getTutorialBorderRadius = (radii: TutorialCornerRadii) => {
  const horizontal = [
    radii.topLeft.horizontal,
    radii.topRight.horizontal,
    radii.bottomRight.horizontal,
    radii.bottomLeft.horizontal,
  ].map((value) => `${formatGeometryValue(value)}px`);
  const vertical = [
    radii.topLeft.vertical,
    radii.topRight.vertical,
    radii.bottomRight.vertical,
    radii.bottomLeft.vertical,
  ].map((value) => `${formatGeometryValue(value)}px`);

  return `${horizontal.join(" ")} / ${vertical.join(" ")}`;
};

export const getTutorialRoundedRectPath = (
  rect: TutorialRect,
  radii: TutorialCornerRadii,
) => {
  const topLeft = radii.topLeft;
  const topRight = radii.topRight;
  const bottomRight = radii.bottomRight;
  const bottomLeft = radii.bottomLeft;
  const top = formatGeometryValue(rect.top);
  const right = formatGeometryValue(rect.right);
  const bottom = formatGeometryValue(rect.bottom);
  const left = formatGeometryValue(rect.left);
  const arc = (radius: TutorialCornerRadius, x: number, y: number) => {
    const horizontal = formatGeometryValue(radius.horizontal);
    const vertical = formatGeometryValue(radius.vertical);
    const destinationX = formatGeometryValue(x);
    const destinationY = formatGeometryValue(y);
    return horizontal > 0 && vertical > 0
      ? `A ${horizontal} ${vertical} 0 0 1 ${destinationX} ${destinationY}`
      : `L ${destinationX} ${destinationY}`;
  };

  return [
    `M ${formatGeometryValue(rect.left + topLeft.horizontal)} ${top}`,
    `H ${formatGeometryValue(rect.right - topRight.horizontal)}`,
    arc(topRight, right, rect.top + topRight.vertical),
    `V ${formatGeometryValue(rect.bottom - bottomRight.vertical)}`,
    arc(bottomRight, rect.right - bottomRight.horizontal, bottom),
    `H ${formatGeometryValue(rect.left + bottomLeft.horizontal)}`,
    arc(bottomLeft, left, rect.bottom - bottomLeft.vertical),
    `V ${formatGeometryValue(rect.top + topLeft.vertical)}`,
    arc(topLeft, rect.left + topLeft.horizontal, top),
    "Z",
  ].join(" ");
};

export const getTutorialCardPosition = (
  spotlight: TutorialRect,
  card: TutorialSize,
  viewport: TutorialViewport,
  gap = 12,
  margin = 12,
): TutorialPosition => {
  const maximumLeft = viewport.width - card.width - margin;
  const centeredLeft = spotlight.left + spotlight.width / 2 - card.width / 2;
  const left = clamp(centeredLeft, margin, maximumLeft);
  const belowTop = spotlight.bottom + gap;
  const aboveTop = spotlight.top - card.height - gap;
  const maximumTop = viewport.height - card.height - margin;

  if (belowTop <= maximumTop) {
    return { top: belowTop, left };
  }

  if (aboveTop >= margin) {
    return { top: aboveTop, left };
  }

  return {
    top: clamp(maximumTop, margin, maximumTop),
    left,
  };
};
