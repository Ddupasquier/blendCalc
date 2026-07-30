import { describe, expect, it, vi } from "vitest";
import {
	buildVercelInteractionMetricRows,
	getVercelInteractionMetricDateRange,
	syncVercelInteractionMetrics,
} from "$lib/server/analytics/vercelInteractionMetrics.server";
import { APP_INTERACTION_METRICS } from "$lib/utils/analytics/appInteractionMetrics";

const jsonResponse = (data: unknown, status = 200) =>
	new Response(JSON.stringify({ version: 1, data }), {
		status,
		headers: { "content-type": "application/json" },
	});

describe("Vercel interaction metric synchronization", () => {
	it("uses completed UTC days for a bounded rolling sync", () => {
		expect(
			getVercelInteractionMetricDateRange(
				new Date("2026-07-30T18:00:00.000Z"),
				3,
			),
		).toEqual({
			since: "2026-07-27",
			until: "2026-07-29",
		});
		expect(() =>
			getVercelInteractionMetricDateRange(new Date(), 32),
		).toThrow("lookback");
	});

	it("normalizes Vercel totals, route patterns, custom events, and explicit zero days", () => {
		const rows = buildVercelInteractionMetricRows({
			since: "2026-07-28",
			until: "2026-07-29",
			dailyVisits: [
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					pageviews: 12,
					visitors: 7,
				},
			],
			dailyRoutes: [
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					route: "/ingredients/[list]",
					pageviews: 8,
					visitors: 5,
				},
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					route: "Others",
					pageviews: 4,
					visitors: 2,
				},
			],
			dailyEvents: [
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					eventName: APP_INTERACTION_METRICS.LOGIN_SUCCESS,
					count: 3,
					visitors: 2,
				},
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					eventName: "unregistered_event",
					count: 99,
					visitors: 99,
				},
			],
		});

		expect(rows).toHaveLength(9);
		expect(rows).toContainEqual({
			metric_date: "2026-07-28",
			metric_key: APP_INTERACTION_METRICS.PAGE_VIEW,
			dimension_key: "route",
			dimension_value: "/ingredients/[list]",
			event_count: 8,
			visitor_count: 5,
		});
		expect(rows).toContainEqual({
			metric_date: "2026-07-29",
			metric_key: APP_INTERACTION_METRICS.LOGIN_SUCCESS,
			dimension_key: "all",
			dimension_value: "all",
			event_count: 0,
			visitor_count: 0,
		});
		expect(
			rows.some(
				(row) => String(row.metric_key) === "unregistered_event",
			),
		).toBe(false);
	});

	it("queries Vercel once per aggregate shape before replacing the range", async () => {
		const requests: URL[] = [];
		const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			requests.push(url);
			const dataset = url.pathname.includes("/events/")
				? "events"
				: "visits";
			const dimensions = url.searchParams.getAll("by");
			if (dataset === "events") {
				return jsonResponse([
					{
						timestamp: "2026-07-28T00:00:00.000Z",
						eventName: APP_INTERACTION_METRICS.PAGE_RELOAD,
						count: 4,
						visitors: 3,
					},
				]);
			}
			if (dimensions.includes("route")) {
				return jsonResponse([]);
			}
			return jsonResponse([
				{
					timestamp: "2026-07-28T00:00:00.000Z",
					pageviews: 20,
					visitors: 11,
				},
			]);
		});
		const replaceMetrics = vi.fn(async (_since, _until, rows) => rows.length);

		const result = await syncVercelInteractionMetrics({
			configuration: {
				accessToken: "test-token",
				projectId: "prj_test",
				teamId: "team_test",
				lookbackDays: 2,
			},
			fetchImpl: fetchImpl as typeof fetch,
			now: new Date("2026-07-30T12:00:00.000Z"),
			replaceMetrics,
			sleep: async () => undefined,
		});

		expect(result).toEqual({
			since: "2026-07-28",
			until: "2026-07-29",
			replacedRows: 8,
		});
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(requests.every((url) => url.searchParams.get("limit") === "100")).toBe(
			true,
		);
		expect(
			requests.every(
				(url) =>
					url.searchParams.get("projectId") === "prj_test" &&
					url.searchParams.get("teamId") === "team_test",
			),
		).toBe(true);
		expect(replaceMetrics).toHaveBeenCalledOnce();
	});

	it("rejects malformed counts instead of writing guessed values", () => {
		expect(() =>
			buildVercelInteractionMetricRows({
				since: "2026-07-29",
				until: "2026-07-29",
				dailyVisits: [
					{
						timestamp: "2026-07-29T00:00:00.000Z",
						pageviews: null,
						visitors: 1,
					},
				],
				dailyRoutes: [],
				dailyEvents: [],
			}),
		).toThrow("page-view count");
	});

	it("retries one transient Vercel request failure before replacing data", async () => {
		let requestCount = 0;
		const fetchImpl = vi.fn(async () => {
			requestCount += 1;
			if (requestCount === 1) throw new TypeError("temporary network error");
			return jsonResponse([]);
		});
		const replaceMetrics = vi.fn(async (_since, _until, rows) => rows.length);

		await expect(
			syncVercelInteractionMetrics({
				configuration: {
					accessToken: "test-token",
					projectId: "prj_test",
					lookbackDays: 1,
				},
				fetchImpl: fetchImpl as typeof fetch,
				now: new Date("2026-07-30T12:00:00.000Z"),
				replaceMetrics,
				sleep: async () => undefined,
			}),
		).resolves.toMatchObject({ replacedRows: 4 });
		expect(fetchImpl).toHaveBeenCalledTimes(4);
		expect(replaceMetrics).toHaveBeenCalledOnce();
	});
});
