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
	// Center within all scrolling ancestors; the native "if needed" helper can
	// leave the first card behind sticky chrome when the document is zoomed.
	await card.evaluate((element) =>
		element.scrollIntoView({
			block: "center",
			inline: "nearest",
			behavior: "auto",
		}),
	);
	const initialArea = await card.evaluate(readVisibleCardArea);
	await card.evaluate((element, { top, bottom }) => {
		const scrollers: HTMLElement[] = [];
		for (
			let parent = element.parentElement;
			parent;
			parent = parent.parentElement
		) {
			const overflow = getComputedStyle(parent).overflowY;
			if (
				/^(auto|scroll)$/.test(overflow) &&
				parent.scrollHeight > parent.clientHeight
			)
				scrollers.push(parent);
		}
		// CSS zoom changes scroll units; keep both corners clear of clipping and
		// fixed navigation instead of comparing pixels hidden behind other UI.
		for (const scroller of scrollers) {
			const rect = element.getBoundingClientRect();
			if (rect.top >= top + 4 && rect.bottom <= bottom - 4) break;
			const scale =
				scroller.getBoundingClientRect().width / scroller.offsetWidth;
			scroller.scrollTop +=
				(rect.top + rect.height / 2 - (top + bottom) / 2) / scale;
		}
	}, initialArea);
	let previousBounds = "";
	await expect
		.poll(async () => {
			const current = JSON.stringify(await card.boundingBox());
			const stable = current === previousBounds;
			previousBounds = current;
			return stable;
		})
		.toBe(true);
	let bounds = await card.boundingBox();
	expect(bounds).not.toBeNull();
	const viewportWidth = await card.page().evaluate(() => window.innerWidth);
	// Native clipped captures drift under root CSS zoom and compact toolbar reflow.
	// Read the full visible capture, then sample measured card coordinates directly.
	// CSS pixels avoid coordinate drift from fractional mobile device scaling.
	const capture = () =>
		card.page().screenshot({ animations: "disabled", scale: "css" });
	let painted = await capture();
	// Disabling animations can finish a pending reflow. Accept only a capture
	// whose exact coordinates remain unchanged; never retry escaped-pixel failures.
	for (let attempt = 0; attempt < 2; attempt++) {
		const after = await card.boundingBox();
		if (JSON.stringify(after) === JSON.stringify(bounds)) break;
		bounds = after;
		expect(bounds).not.toBeNull();
		painted = await capture();
	}
	expect(await card.boundingBox()).toEqual(bounds);
	// Clipping ancestors can move with scrolling; read their captured positions.
	const visibleArea = await card.evaluate(readVisibleCardArea);
	expect(bounds!.y).toBeGreaterThanOrEqual(visibleArea.top);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(visibleArea.bottom);
	const geometry = await card.evaluate((element) => {
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
	const { data, info } = await sharp(painted)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	expect(info.width).toBe(viewportWidth);
	const viewportScale = info.width / viewportWidth;
	const scale = (bounds!.width / geometry.layoutWidth) * viewportScale;
	const left = Math.round(bounds!.x * viewportScale);
	const right = Math.round((bounds!.x + bounds!.width) * viewportScale) - 1;
	const top = Math.round(bounds!.y * viewportScale);
	const bottom = Math.round((bounds!.y + bounds!.height) * viewportScale) - 1;
	expect(left).toBeGreaterThanOrEqual(0);
	expect(right).toBeLessThan(info.width);
	expect(top).toBeGreaterThanOrEqual(0);
	expect(bottom).toBeLessThan(info.height);
	let checkedPixels = 0;
	let escapedPixels = 0;
	for (const corner of ["top", "bottom"] as const) {
		const radius = Math.min(
			(corner === "top" ? geometry.topRadius : geometry.bottomRadius) * scale,
			(bounds!.height * viewportScale) / 2,
		);
		for (let row = 0; row < Math.ceil(radius); row++) {
			const y = corner === "top" ? top + row : bottom - row;
			for (let x = 0; x < Math.ceil(radius); x++) {
				// Exclude only the rasterized antialias fringe and subpixel capture rounding.
				if (
					Math.hypot(x + 0.5 - radius, row + 0.5 - radius) <=
					radius + 2 * scale
				)
					continue;
				checkedPixels++;
				const offset = (y * info.width + left + x) * 4;
				// Compare symmetric cutouts on the same row. A fixed bottom-corner
				// reference can lie on the sticky navigation's separator at 200% zoom.
				const reference = (y * info.width + right - x) * 4;
				if (
					[0, 1, 2, 3].some(
						(channel) =>
							Math.abs(data[offset + channel] - data[reference + channel]) > 3,
					)
				)
					escapedPixels++;
			}
		}
	}
	expect(checkedPixels).toBeGreaterThan(0);
	if (escapedPixels) {
		await test.info().attach("containment-failure", {
			body: painted,
			contentType: "image/png",
		});
		await test.info().attach("paint-capture-geometry", {
			body: JSON.stringify({
				bounds,
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
	expect(
		escapedPixels,
		"No media may paint outside either rounded left corner",
	).toBe(0);
	return painted;
};
