import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const organizer = readFileSync(
	"src/lib/components/mix/layout/MixSectionOrganizer/MixSectionOrganizer.svelte",
	"utf8",
);
const organizerStyles = readFileSync(
	"src/lib/components/mix/layout/MixSectionOrganizer/MixSectionOrganizer.scss",
	"utf8",
);
const mixPage = readFileSync("src/routes/mix/+page.svelte", "utf8");
const optionsSheet = readFileSync(
	"src/lib/components/mix/layout/MixOptionsSheet/MixOptionsSheet.svelte",
	"utf8",
);

describe("Mix section reorganization architecture", () => {
	it("provides pointer, touch, keyboard, and animated displacement controls", () => {
		expect(organizer).toContain("onpointerdown");
		expect(organizer).toContain("onpointermove");
		expect(organizer).toContain("onpointerup");
		expect(organizer).toContain("organizerElement.setPointerCapture");
		expect(organizer).toContain("getClosestDragTarget");
		expect(organizer).toContain("handleDragKeydown");
		expect(organizer).toContain("dragPosition");
		expect(organizer).toContain("dragCenterY");
		expect(organizer).toContain("animate:flip");
		expect(organizer).toContain("MOTION_EASING_FUNCTION.spatial");
		expect(organizer).toContain("mix-section-organizer__slot--displacing");
		expect(organizer).toContain("data-mix-drag-preview");
		expect(organizer).toContain("mix-section-organizer__item--placeholder");
		expect(organizerStyles).toContain("overflow: clip");
		expect(organizerStyles).not.toContain("transform: scale(1.01)");
		expect(organizer).toContain("getMotionSafeDuration");
		expect(organizer).toContain('aria-live="polite"');
		expect(organizer).toContain("disabled={busy}");
		expect(organizer).toContain("Move ${getMixSectionLabel(sectionId)} up");
		expect(organizer).toContain("Move ${getMixSectionLabel(sectionId)} down");
	});

	it("opens from Mix options and replaces section bodies with headers", () => {
		expect(optionsSheet).toContain('label="Reorganize"');
		expect(mixPage).toContain("reorganizeMode");
		expect(mixPage).toContain("<MixSectionOrganizer");
		expect(mixPage).toContain(
			"{#each sectionPreferences.state.order as sectionId",
		);
	});
});
