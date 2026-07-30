import type { StatusMessageTone } from "$lib/components/common/feedback/StatusMessage/types";
import type { FoodDataQualityNotice } from "./foodDataQuality";

export type FoodDataQualityMessage = {
	tone: StatusMessageTone;
	title: string;
	message: string;
};

const formatCount = (count: number | undefined) =>
	Number.isSafeInteger(count) && (count ?? 0) > 0 ? count : 2;

export const getFoodDataQualityMessage = (
	notice: FoodDataQualityNotice,
): FoodDataQualityMessage => {
	switch (notice.code) {
		case "SOURCE_RECORD_OBSOLETE":
			return {
				tone: "warning",
				title: "This source record may be outdated",
				message:
					"The source marks this record as obsolete. Check the current package label for the latest product information.",
			};
		case "SOURCE_RECORD_ERROR":
			return {
				tone: "danger",
				title: "The source reported a data issue",
				message:
					"Some source details may need review. blendCalc only shows accepted values it can trace and keeps this source note separate from verification.",
			};
		case "SOURCE_RECORD_WARNING":
			return {
				tone: "warning",
				title: "The source flagged this record for review",
				message:
					"This is a note from the source record, not a blendCalc verdict. Check Product details to see where accepted fields came from.",
			};
		case "SOURCE_RECORD_PARTIAL":
			return {
				tone: "warning",
				title: "Some source details may be missing",
				message:
					`The source reports this record as ${notice.percentage ?? 0}% complete. blendCalc leaves unavailable values blank instead of guessing.`,
			};
		case "SOURCE_RECORD_QUALITY_NOTES":
			return {
				tone: "info",
				title: "The source included additional review notes",
				message:
					"These notes describe the incoming source record. They do not automatically change whether an accepted blendCalc field is verified.",
			};
		case "ACCEPTED_FIELDS_COMBINE_SOURCES":
			return {
				tone: "info",
				title: "Accepted fields come from more than one source",
				message:
					`blendCalc combined traceable fields from ${formatCount(notice.count)} sources instead of choosing one source for the whole product. Product details lists each field's source.`,
			};
		case "SOURCE_METADATA_COMBINES_RECORDS":
			return {
				tone: "info",
				title: "Some source labels combine records",
				message:
					`The source assembled label metadata from ${formatCount(notice.count)} contributing records. This note does not replace field-level verification.`,
			};
	}
};
