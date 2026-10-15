export type FavoriteKind = "food" | "recipe";
export type FavoriteState = { favorite: boolean } | null;
export type FavoriteChange = {
	kind: FavoriteKind;
	targetId: string;
	favorite: boolean;
};
export const FAVORITES_CHANGED_EVENT = "blendcalc-favorites-changed";
