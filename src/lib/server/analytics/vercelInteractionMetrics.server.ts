import { env } from "$env/dynamic/private";
import type { Json } from "$lib/types/database.types";
import {
	APP_INTERACTION_METRICS,
	VERCEL_CUSTOM_INTERACTION_METRICS,
	type AppInteractionMetric,
} from "$lib/utils/analytics/appInteractionMetrics";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

const VERCEL_ANALYTICS_API =
	"https://api.vercel.com/v1/query/web-analytics";
const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 31;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_ATTEMPTS = 2;

type VercelInteractionMetricsConfiguration = {
	accessToken: string;
	projectId: string;
	teamId?: string;
	lookbackDays: number;
};

type VercelAggregateRow = {
	timestamp?: unknown;
	pageviews?: unknown;
	visitors?: unknown;
	count?: unknown;
	route?: unknown;
	eventName?: unknown;
};

type VercelAggregateResponse = {
	version?: unknown;
	data?: unknown;
};

export type AppInteractionDailyMetricRow = {
	metric_date: string;
	metric_key: AppInteractionMetric;
	dimension_key: "all" | "route";
	dimension_value: string;
	event_count: number;
	visitor_count: number | null;
};

type VercelInteractionMetricsDependencies = {
	configuration?: VercelInteractionMetricsConfiguration;
	fetchImpl?: typeof fetch;
	now?: Date;
	replaceMetrics?: (
		since: string,
		until: string,
		rows: AppInteractionDailyMetricRow[],
	) => Promise<number>;
	sleep?: (milliseconds: number) => Promise<void>;
};

const toUtcDate = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
};

const enumerateDates = (since: string, until: string) => {
	const dates: string[] = [];
	let current = new Date(`${since}T00:00:00.000Z`);
	const end = new Date(`${until}T00:00:00.000Z`);
	while (current <= end) {
		dates.push(toUtcDate(current));
		current = addUtcDays(current, 1);
	}
	return dates;
};

const readNonNegativeInteger = (
	value: unknown,
	fieldName: string,
): number => {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		value < 0
	) {
		throw new Error(`Vercel returned an invalid ${fieldName}.`);
	}
	return value;
};

const readMetricDate = (
	value: unknown,
	since: string,
	until: string,
) => {
	if (typeof value !== "string") {
		throw new Error("Vercel returned an invalid aggregate timestamp.");
	}
	const metricDate = value.slice(0, 10);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(metricDate) ||
		metricDate < since ||
		metricDate > until
	) {
		throw new Error("Vercel returned an aggregate outside the requested range.");
	}
	return metricDate;
};

const getRowKey = (row: AppInteractionDailyMetricRow) =>
	[
		row.metric_date,
		row.metric_key,
		row.dimension_key,
		row.dimension_value,
	].join("\u0000");

const getConfiguredLookbackDays = () => {
	const configuredValue = env.VERCEL_ANALYTICS_SYNC_LOOKBACK_DAYS?.trim();
	if (!configuredValue) return DEFAULT_LOOKBACK_DAYS;
	const configured = Number(configuredValue);
	if (!Number.isInteger(configured)) return DEFAULT_LOOKBACK_DAYS;
	return Math.min(Math.max(configured, 1), MAX_LOOKBACK_DAYS);
};

export const getVercelInteractionMetricsConfiguration =
	(): VercelInteractionMetricsConfiguration => {
		const accessToken = env.VERCEL_ANALYTICS_ACCESS_TOKEN?.trim();
		const projectId = env.VERCEL_PROJECT_ID?.trim();
		const teamId = env.VERCEL_TEAM_ID?.trim();

		if (!accessToken || !projectId) {
			throw new Error(
				"Vercel interaction metric synchronization is not configured.",
			);
		}

		return {
			accessToken,
			projectId,
			teamId: teamId || undefined,
			lookbackDays: getConfiguredLookbackDays(),
		};
	};

export const getVercelInteractionMetricDateRange = (
	now: Date,
	lookbackDays: number,
) => {
	if (
		!Number.isInteger(lookbackDays) ||
		lookbackDays < 1 ||
		lookbackDays > MAX_LOOKBACK_DAYS
	) {
		throw new Error("The Vercel analytics lookback is invalid.");
	}
	const today = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const until = addUtcDays(today, -1);
	const since = addUtcDays(until, -(lookbackDays - 1));
	return {
		since: toUtcDate(since),
		until: toUtcDate(until),
	};
};

const getVercelAggregateRows = async ({
	dataset,
	by,
	filter,
	since,
	until,
	configuration,
	fetchImpl,
	sleep,
}: {
	dataset: "visits" | "events";
	by: string[];
	filter: string;
	since: string;
	until: string;
	configuration: VercelInteractionMetricsConfiguration;
	fetchImpl: typeof fetch;
	sleep: (milliseconds: number) => Promise<void>;
}) => {
	const url = new URL(`${VERCEL_ANALYTICS_API}/${dataset}/aggregate`);
	url.searchParams.set("projectId", configuration.projectId);
	if (configuration.teamId) {
		url.searchParams.set("teamId", configuration.teamId);
	}
	url.searchParams.set("since", since);
	url.searchParams.set("until", until);
	url.searchParams.set("limit", "100");
	for (const dimension of by) {
		url.searchParams.append("by", dimension);
	}
	url.searchParams.set("filter", filter);

	let response: Response | null = null;
	for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
		try {
			response = await fetchImpl(url, {
				headers: {
					authorization: `Bearer ${configuration.accessToken}`,
					accept: "application/json",
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (requestError) {
			if (attempt === MAX_REQUEST_ATTEMPTS) throw requestError;
			await sleep(250 * attempt);
			continue;
		}
		if (response.ok) break;
		if (
			attempt === MAX_REQUEST_ATTEMPTS ||
			(response.status !== 429 && response.status < 500)
		) {
			throw new Error(
				`Vercel analytics request failed with status ${response.status}.`,
			);
		}
		await sleep(250 * attempt);
	}

	const payload = (await response?.json()) as VercelAggregateResponse;
	if (payload.version !== 1 || !Array.isArray(payload.data)) {
		throw new Error("Vercel returned an unsupported analytics response.");
	}
	return payload.data as VercelAggregateRow[];
};

const buildEmptyMetricRows = (since: string, until: string) => {
	const rows: AppInteractionDailyMetricRow[] = [];
	for (const metricDate of enumerateDates(since, until)) {
		rows.push({
			metric_date: metricDate,
			metric_key: APP_INTERACTION_METRICS.PAGE_VIEW,
			dimension_key: "all",
			dimension_value: "all",
			event_count: 0,
			visitor_count: 0,
		});
		for (const metric of VERCEL_CUSTOM_INTERACTION_METRICS) {
			rows.push({
				metric_date: metricDate,
				metric_key: metric,
				dimension_key: "all",
				dimension_value: "all",
				event_count: 0,
				visitor_count: 0,
			});
		}
	}
	return rows;
};

export const buildVercelInteractionMetricRows = ({
	since,
	until,
	dailyVisits,
	dailyRoutes,
	dailyEvents,
}: {
	since: string;
	until: string;
	dailyVisits: VercelAggregateRow[];
	dailyRoutes: VercelAggregateRow[];
	dailyEvents: VercelAggregateRow[];
}) => {
	const rows = new Map(
		buildEmptyMetricRows(since, until).map((row) => [getRowKey(row), row]),
	);

	for (const aggregate of dailyVisits) {
		const row: AppInteractionDailyMetricRow = {
			metric_date: readMetricDate(aggregate.timestamp, since, until),
			metric_key: APP_INTERACTION_METRICS.PAGE_VIEW,
			dimension_key: "all",
			dimension_value: "all",
			event_count: readNonNegativeInteger(
				aggregate.pageviews,
				"page-view count",
			),
			visitor_count: readNonNegativeInteger(
				aggregate.visitors,
				"visitor count",
			),
		};
		rows.set(getRowKey(row), row);
	}

	for (const aggregate of dailyRoutes) {
		if (
			typeof aggregate.route !== "string" ||
			!aggregate.route.startsWith("/") ||
			aggregate.route.length > 240
		) {
			continue;
		}
		const row: AppInteractionDailyMetricRow = {
			metric_date: readMetricDate(aggregate.timestamp, since, until),
			metric_key: APP_INTERACTION_METRICS.PAGE_VIEW,
			dimension_key: "route",
			dimension_value: aggregate.route,
			event_count: readNonNegativeInteger(
				aggregate.pageviews,
				"route page-view count",
			),
			visitor_count: readNonNegativeInteger(
				aggregate.visitors,
				"route visitor count",
			),
		};
		rows.set(getRowKey(row), row);
	}

	for (const aggregate of dailyEvents) {
		if (
			typeof aggregate.eventName !== "string" ||
			!VERCEL_CUSTOM_INTERACTION_METRICS.includes(
				aggregate.eventName as (typeof VERCEL_CUSTOM_INTERACTION_METRICS)[number],
			)
		) {
			continue;
		}
		const row: AppInteractionDailyMetricRow = {
			metric_date: readMetricDate(aggregate.timestamp, since, until),
			metric_key: aggregate.eventName as AppInteractionMetric,
			dimension_key: "all",
			dimension_value: "all",
			event_count: readNonNegativeInteger(
				aggregate.count,
				"custom-event count",
			),
			visitor_count: readNonNegativeInteger(
				aggregate.visitors,
				"custom-event visitor count",
			),
		};
		rows.set(getRowKey(row), row);
	}

	return [...rows.values()].sort((left, right) =>
		getRowKey(left).localeCompare(getRowKey(right)),
	);
};

const replaceInteractionMetrics = async (
	since: string,
	until: string,
	rows: AppInteractionDailyMetricRow[],
) => {
	const { data, error } = await getSupabaseAdminClient().rpc(
		"replace_app_interaction_daily_metrics",
		{
			p_metrics: rows as Json,
			p_since: since,
			p_until: until,
		},
	);
	if (error) throw error;
	return data;
};

export const syncVercelInteractionMetrics = async (
	dependencies: VercelInteractionMetricsDependencies = {},
) => {
	const configuration =
		dependencies.configuration ??
		getVercelInteractionMetricsConfiguration();
	const fetchImpl = dependencies.fetchImpl ?? fetch;
	const now = dependencies.now ?? new Date();
	const sleep =
		dependencies.sleep ??
		((milliseconds: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
	const replaceMetrics =
		dependencies.replaceMetrics ?? replaceInteractionMetrics;
	const range = getVercelInteractionMetricDateRange(
		now,
		configuration.lookbackDays,
	);
	const eventFilter = [
		"environment eq 'production'",
		`eventName in (${VERCEL_CUSTOM_INTERACTION_METRICS.map(
			(metric) => `'${metric}'`,
		).join(",")})`,
	].join(" and ");

	const queryAggregate = (
		dataset: "visits" | "events",
		by: string[],
		filter: string,
	) =>
		getVercelAggregateRows({
			dataset,
			by,
			filter,
			since: range.since,
			until: range.until,
			configuration,
			fetchImpl,
			sleep,
		});

	const [dailyVisits, dailyRoutes, dailyEvents] = await Promise.all([
		queryAggregate("visits", ["day"], "environment eq 'production'"),
		queryAggregate(
			"visits",
			["day", "route"],
			"environment eq 'production'",
		),
		queryAggregate("events", ["day", "eventName"], eventFilter),
	]);
	const rows = buildVercelInteractionMetricRows({
		...range,
		dailyVisits,
		dailyRoutes,
		dailyEvents,
	});
	const replacedRows = await replaceMetrics(range.since, range.until, rows);

	return {
		...range,
		replacedRows,
	};
};
