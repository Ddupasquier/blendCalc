import type { ImagePlacementValue } from "$lib/utils/food/images/types";

export type ImagePlacementReviewWorkspace = {
	automationEnabled: boolean;
	pendingImages: number;
	images: Array<{
		id: string;
		name: string;
		imageUrl: string;
		source: string;
		sourceReference: string | null;
		licenseName: string;
		licenseUrl: string | null;
		attributionText: string | null;
		revision: number;
		locked: boolean;
		placement: ImagePlacementValue;
		suggestions: Array<{
			id: string;
			placement: ImagePlacementValue;
			votes: number;
			eligibleVotes: number;
			contributors: Array<{
				id: string;
				trusted: boolean;
				restricted: boolean;
			}>;
		}>;
		history: Array<{
			revision: number;
			previous: ImagePlacementValue;
			next: ImagePlacementValue;
			createdAt: string;
			canUndo: boolean;
		}>;
	}>;
};
