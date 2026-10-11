import type { Locator } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./browserTest";

const readVisibleCardArea = (element: Element) => {
	let top = 0;
	let bottom = window.innerHeight;
	for (
		let parent = element.parentElement;
		parent;
		parent = parent.parentElement
	) {
		if (
			/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowY)
		) {
			const rect = parent.getBoundingClientRect();
			top = Math.max(top, rect.top);
			bottom = Math.min(bottom, rect.bottom);
		}
	}
	const header = document.querySelector("header.app-header");
	if (header && /^(fixed|sticky)$/.test(getComputedStyle(header).position)) {
		const rect = header.getBoundingClientRect();
		if (rect.top < window.innerHeight / 2) top = Math.max(top, rect.bottom);
	}
	const navigation = document.querySelector(
		'nav[aria-label="Main navigation"]',
	);
	if (navigation) {
		const rect = navigation.getBoundingClientRect();
		if (rect.top > window.innerHeight / 2) bottom = Math.min(bottom, rect.top);
	}
	return { top, bottom };
};

// Crop/zoom can extend an image beneath its clipping layer; inspect painted
// cutouts rather than requiring the un-clipped image bounds to fit the card.
export const expectPaintedMediaContainment = async (card: Locator) => {
	const lane = card.locator(".ingredient-card-media-lane");
	await expect(lane).toBeVisible();
	// Lazy image failures can change which card matches a fallback locator.
	// Pin the actual rendered card for the entire two-corner measurement.
	const capturedCard = await card.elementHandle();
	expect(capturedCard).not.toBeNull();
	try {
		// Finish panel expansion before scrolling and measuring its painted card.
		await card.page().screenshot({ animations: "disabled", scale: "css" });
		const viewportWidth = await card.page().evaluate(() => window.innerWidth);
		const geometry = await capturedCard!.evaluate((element) => {
			const styles = getComputedStyle(element);
			const media = element.querySelector(".ingredient-card-media-lane");
			const frame = element.querySelector(".card-warning-frame");
			return {
				layoutWidth: (element as HTMLElement).offsetWidth,
				topRadius: Number.parseFloat(styles.borderTopLeftRadius),
				bottomRadius: Number.parseFloat(styles.borderBottomLeftRadius),
				overflowX: styles.overflowX,
				overflowY: styles.overflowY,
				mediaLayer: media ? Number(getComputedStyle(media).zIndex) : null,
				frameLayer: frame ? Number(getComputedStyle(frame).zIndex) : null,
			};
		});
		expect(geometry.topRadius).toBeGreaterThan(0);
		expect(geometry.bottomRadius).toBeGreaterThan(0);
		expect(geometry.overflowX).toBe("hidden");
		expect(geometry.overflowY).toBe("hidden");
		if (geometry.frameLayer !== null)
			expect(geometry.frameLayer).toBeGreaterThan(geometry.mediaLayer!);

		let checkedPixels = 0;
		let escapedPixels = 0;
		let painted: Buffer | undefined;
		// At 200% zoom the sticky toolbar can leave less space than a whole card.
		// Scroll each complete rounded corner into view and inspect both; never sample
		// pixels hidden by an ancestor or navigation, or relax the zero-escape contract.
		for (const corner of ["top", "bottom"] as const) {
			await capturedCard!.evaluate((element) =>
				element.scrollIntoView({
					block: "center",
					inline: "nearest",
					behavior: "instant",
				}),
			);
			// WebKit applies zoomed scrollIntoView geometry on the next render frame.
			await card
				.page()
				.evaluate(
					() =>
						new Promise<void>((resolve) =>
							requestAnimationFrame(() => resolve()),
						),
				);
			// Compact headers can reflow after scrolling. Re-measure the actual
			// clipping region after each bounded adjustment, without recentering.
			const positioning: unknown[] = [];
			for (let pass = 0; pass < 3; pass++) {
				const area = await capturedCard!.evaluate(readVisibleCardArea);
				const adjustments = await capturedCard!.evaluate(
					(element, { top, bottom, corner }) => {
						const changes = [];
						for (
							let parent = element.parentElement;
							parent;
							parent = parent.parentElement
						) {
							// Hidden overflow is still programmatically scrollable. Zoom
							// can make its visual clipping tighter than clientHeight.
							if (
								!/^(auto|scroll|hidden)$/.test(
									getComputedStyle(parent).overflowY,
								)
							)
								continue;
							const rect = element.getBoundingClientRect();
							const cardScale =
								rect.width / (element as HTMLElement).offsetWidth;
							const radius = Math.min(
								Number.parseFloat(
									getComputedStyle(element)[
										corner === "top"
											? "borderTopLeftRadius"
											: "borderBottomLeftRadius"
									],
								) * cardScale,
								rect.height / 2,
							);
							const segmentTop =
								corner === "top" ? rect.top : rect.bottom - radius;
							const segmentBottom =
								corner === "top" ? rect.top + radius : rect.bottom;
							if (segmentTop >= top + 4 && segmentBottom <= bottom - 4) break;
							const delta =
								corner === "top"
									? rect.top - (top + 4)
									: rect.bottom - (bottom - 4);
							const measuredScale =
								parent.getBoundingClientRect().width / parent.offsetWidth;
							const scale =
								Number.isFinite(measuredScale) && measuredScale > 0
									? measuredScale
									: 1;
							const beforeScroll = parent.scrollTop;
							parent.scrollTo({
								top: parent.scrollTop + delta / scale,
								behavior: "instant",
							});
							changes.push({
								parent: parent.tagName,
								className: parent.className,
								beforeScroll,
								afterScroll: parent.scrollTop,
								scrollHeight: parent.scrollHeight,
								clientHeight: parent.clientHeight,
								scale,
								beforeTop: rect.top,
								afterTop: element.getBoundingClientRect().top,
							});
						}
						return changes;
					},
					{ ...area, corner },
				);
				await card
					.page()
					.evaluate(
						() =>
							new Promise<void>((resolve) =>
								requestAnimationFrame(() =>
									requestAnimationFrame(() => resolve()),
								),
							),
					);
				const positioned = await capturedCard!.boundingBox();
				const positionedArea =
					await capturedCard!.evaluate(readVisibleCardArea);
				positioning.push({ pass, positioned, positionedArea, adjustments });
				if (positioned) {
					const positionedRadius = Math.min(
						((corner === "top" ? geometry.topRadius : geometry.bottomRadius) *
							positioned.width) /
							geometry.layoutWidth,
						positioned.height / 2,
					);
					const start =
						corner === "top"
							? positioned.y
							: positioned.y + positioned.height - positionedRadius;
					const end =
						corner === "top"
							? positioned.y + positionedRadius
							: positioned.y + positioned.height;
					if (
						start >= positionedArea.top + 4 &&
						end <= positionedArea.bottom - 4
					)
						break;
				}
			}
			let previousBounds = "";
			await expect
				.poll(async () => {
					const current = JSON.stringify(await capturedCard!.boundingBox());
					const stable = current === previousBounds;
					previousBounds = current;
					return stable;
				})
				.toBe(true);
			let bounds = await capturedCard!.boundingBox();
			expect(bounds).not.toBeNull();
			const capture = () =>
				card.page().screenshot({ animations: "disabled", scale: "css" });
			painted = await capture();
			// Accept only exact stable capture coordinates; never retry escaped pixels.
			for (let attempt = 0; attempt < 2; attempt++) {
				const after = await capturedCard!.boundingBox();
				if (JSON.stringify(after) === JSON.stringify(bounds)) break;
				bounds = after;
				expect(bounds).not.toBeNull();
				painted = await capture();
			}
			expect(await capturedCard!.boundingBox()).toEqual(bounds);
			const visibleArea = await capturedCard!.evaluate(readVisibleCardArea);
			const { data, info } = await sharp(painted)
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });
			expect(info.width).toBe(viewportWidth);
			const viewportScale = info.width / viewportWidth;
			const scale = (bounds!.width / geometry.layoutWidth) * viewportScale;
			const radius = Math.min(
				(corner === "top" ? geometry.topRadius : geometry.bottomRadius) * scale,
				(bounds!.height * viewportScale) / 2,
			);
			const left = Math.round(bounds!.x * viewportScale);
			const right = Math.round((bounds!.x + bounds!.width) * viewportScale) - 1;
			const edge =
				corner === "top"
					? Math.round(bounds!.y * viewportScale)
					: Math.round((bounds!.y + bounds!.height) * viewportScale) - 1;
			const segmentStart =
				corner === "top"
					? bounds!.y
					: bounds!.y + bounds!.height - radius / viewportScale;
			const segmentEnd =
				corner === "top"
					? bounds!.y + radius / viewportScale
					: bounds!.y + bounds!.height;
			if (segmentStart < visibleArea.top || segmentEnd > visibleArea.bottom) {
				await test.info().attach(`card-position-${corner}`, {
					body: JSON.stringify({ positioning, bounds, visibleArea, geometry }),
					contentType: "application/json",
				});
			}
			expect(left).toBeGreaterThanOrEqual(0);
			expect(right).toBeLessThan(info.width);
			if (corner === "top") {
				expect(bounds!.y).toBeGreaterThanOrEqual(visibleArea.top);
				expect(bounds!.y * viewportScale + radius).toBeLessThanOrEqual(
					visibleArea.bottom * viewportScale,
				);
			} else {
				expect(
					(bounds!.y + bounds!.height) * viewportScale - radius,
				).toBeGreaterThanOrEqual(visibleArea.top * viewportScale);
				expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
					visibleArea.bottom,
				);
			}
			let cornerEscapedPixels = 0;
			for (let row = 0; row < Math.ceil(radius); row++) {
				const y = corner === "top" ? edge + row : edge - row;
				for (let x = 0; x < Math.ceil(radius); x++) {
					// Exclude only rasterized antialias fringe and subpixel capture rounding.
					if (
						Math.hypot(x + 0.5 - radius, row + 0.5 - radius) <=
						radius + 2 * scale
					)
						continue;
					checkedPixels++;
					const offset = (y * info.width + left + x) * 4;
					const reference = (y * info.width + right - x) * 4;
					if (
						[0, 1, 2, 3].some(
							(channel) =>
								Math.abs(data[offset + channel] - data[reference + channel]) >
								3,
						)
					)
						cornerEscapedPixels++;
				}
			}
			escapedPixels += cornerEscapedPixels;
			if (cornerEscapedPixels) {
				await test.info().attach(`containment-failure-${corner}`, {
					body: painted,
					contentType: "image/png",
				});
				await test.info().attach(`paint-capture-geometry-${corner}`, {
					body: JSON.stringify({
						corner,
						bounds,
						visibleArea,
						geometry,
						info,
						viewportWidth,
						scale,
						checkedPixels,
						escapedPixels,
					}),
					contentType: "application/json",
				});
			}
		}
		expect(checkedPixels).toBeGreaterThan(0);
		expect(
			escapedPixels,
			"No media may paint outside either rounded left corner",
		).toBe(0);
		return painted!;
	} finally {
		await capturedCard?.dispose();
	}
};
