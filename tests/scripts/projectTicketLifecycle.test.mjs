import { describe, expect, it } from "vitest";
import {
	assertHomogeneousProjectTicketBatch,
	assertProjectTicketCanStart,
	assertReadyForMainBatchEligible,
	assertStageBatchEligible,
	assertTicketNeutralBatchEvidence,
	approvedProjectTicketNextAction,
	classifyProjectTicketDelivery,
	PROJECT_TICKET_DELIVERY_CLASS,
} from "../../scripts/lib/releases/project_ticket_lifecycle.mjs";

const ticket = (overrides = {}) => ({
	taskId: "DEV-001",
	workType: "Development",
	status: "Approved",
	branch: "fix/DEV-001-example",
	changeReference: "Uncommitted local review",
	...overrides,
});

describe("Project ticket lifecycle classification", () => {
	it("classifies staging-reviewed QA as verification-only", () => {
		expect(
			classifyProjectTicketDelivery(
				ticket({
					taskId: "QA-069-001",
					workType: "QA",
					branch: "staging",
					changeReference: "Staging review",
				}),
			),
		).toBe(PROJECT_TICKET_DELIVERY_CLASS.verification);
	});

	it("classifies dedicated and staged implementation work", () => {
		expect(classifyProjectTicketDelivery(ticket())).toBe(
			PROJECT_TICKET_DELIVERY_CLASS.implementation,
		);
		expect(
			classifyProjectTicketDelivery(
				ticket({
					status: "In Staging",
					branch: "staging",
					changeReference: "a3ddc724",
				}),
			),
		).toBe(PROJECT_TICKET_DELIVERY_CLASS.implementation);
	});

	it("keeps operational or manual work outside the Git release path", () => {
		expect(
			classifyProjectTicketDelivery(
				ticket({
					taskId: "API-LEGAL-006",
					workType: "Operations",
					branch: "main",
					changeReference: "Not applicable while blocked",
				}),
			),
		).toBe(PROJECT_TICKET_DELIVERY_CLASS.operational);
	});

	it("rejects mixed lifecycle batches", () => {
		expect(() =>
			assertHomogeneousProjectTicketBatch([
				ticket(),
				ticket({
					taskId: "QA-069-001",
					workType: "QA",
					branch: "staging",
					changeReference: "Staging review",
				}),
			]),
		).toThrow("cannot mix delivery classifications");
	});

	it("requires Inbox triage and keeps completed tickets terminal", () => {
		for (const status of ["Inbox", "Done"]) {
			expect(() => assertProjectTicketCanStart(ticket({ status }))).toThrow(
				"triage it into the correct active state first",
			);
		}
		expect(() =>
			assertProjectTicketCanStart(ticket({ status: "Ready" })),
		).not.toThrow();
	});

	it("keeps post-approval actions concise and delivery-class aware", () => {
		const longPriorInstruction = "x".repeat(2_000);
		const verificationAction = approvedProjectTicketNextAction(
			ticket({
				taskId: "QA-080-002",
				workType: "QA",
				branch: "staging",
				changeReference: "Staging review",
				verification: "Passed",
				previousNextAction: longPriorInstruction,
			}),
		);

		expect(verificationAction).toContain("verification-only");
		expect(verificationAction).not.toContain(longPriorInstruction);
		expect(verificationAction.length).toBeLessThan(512);
		expect(
			approvedProjectTicketNextAction(
				ticket({
					taskId: "DEV-004",
					workType: "Operations",
					branch: "main",
					changeReference: "Not applicable while blocked",
				}),
			),
		).toContain("operational or manual action");
	});

	it("rejects verification-only tickets from staging promotion", () => {
		expect(() =>
			assertStageBatchEligible(
				[
					ticket({
						taskId: "QA-069-001",
						workType: "QA",
						branch: "staging",
						changeReference: "Staging review",
					}),
				],
				"Existing main evidence passed.",
			),
		).toThrow("verification-only");
	});

	it("accepts a homogeneous implementation staging batch", () => {
		expect(() =>
			assertStageBatchEligible(
				[ticket(), ticket({ taskId: "DEV-002" })],
				"The exact candidate checks passed.",
			),
		).not.toThrow();
	});

	it("requires staged implementation before Ready for Main", () => {
		expect(() =>
			assertReadyForMainBatchEligible(
				[ticket()],
				"The exact staging checks passed.",
			),
		).toThrow("must be an In Staging implementation");
		expect(() =>
			assertReadyForMainBatchEligible(
				[
					ticket({
						status: "In Staging",
						branch: "staging",
						changeReference: "a3ddc724",
					}),
				],
				"The exact staging checks passed.",
			),
		).not.toThrow();
	});

	it("rejects ticket IDs in shared batch evidence", () => {
		expect(() =>
			assertTicketNeutralBatchEvidence(
				[ticket(), ticket({ taskId: "DEV-002" })],
				"DEV-001 passed and should ship with DEV-002.",
			),
		).toThrow("ticket-neutral");
	});
});
