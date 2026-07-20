import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Json } from "$lib/types/database.types";

export type CloudMixPreferences = {
	nutrientGoals?: Record<number, number>;
	mixState?: Record<string, unknown>;
};

export const CLOUD_CURSOR_PAGE_SIZE = 500;

type CursorPage<Row> = {
	data: Row[] | null;
	error: unknown;
};

export const readAllCursorPages = async <Row extends { id: string }>(
	readPage: (cursorId: string | null) => Promise<CursorPage<Row>>,
) => {
	const rows: Row[] = [];
	let cursorId: string | null = null;

	while (true) {
		const { data, error } = await readPage(cursorId);
		if (error || !data) {
			throw error ?? new Error("Cloud data page could not be loaded.");
		}

		rows.push(...data);
		if (data.length < CLOUD_CURSOR_PAGE_SIZE) return rows;

		cursorId = data[data.length - 1].id;
	}
};

export const getCurrentUserId = async () => {
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

	const { data, error } = await supabase.auth.getClaims();
	if (error) throw error;
	if (!data?.claims.sub) return null;
	return data.claims.sub;
};

export const toJson = (value: unknown): Json => {
	return JSON.parse(JSON.stringify(value)) as Json;
};

export const getNumberRecord = (value: Json): Record<number, number> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};

	return Object.fromEntries(
		Object.entries(value)
			.map(([key, item]) => [Number(key), Number(item)])
			.filter(([key, item]) => Number.isFinite(key) && Number.isFinite(item)),
	);
};

export const getObjectRecord = (value: Json): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
};
