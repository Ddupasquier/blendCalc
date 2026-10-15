import type { FavoriteKind, FavoriteState } from "$lib/utils/favorites/types";
export type FavoriteButtonProps = {
	kind: FavoriteKind;
	targetId: string;
	name: string;
	initialState?: FavoriteState;
	disabled?: boolean;
};

export type FavoriteRequestOptions = RequestInit;
