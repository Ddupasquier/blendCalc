export const PROJECT_TICKET_DELIVERY_CLASS = Object.freeze({
	implementation: "implementation-delivery",
	operational: "operational-manual",
	verification: "verification-only",
});

const integrationBranches = new Set(["main", "staging"]);
const taskIdPattern = /\b(?:API(?:-[A-Z]+)*|DEV|QA)-\d{3}(?:-\d{3})?\b/g;
const restartableStatuses = new Set([
	"Ready",
	"In Progress",
	"User Verification",
	"In Staging",
	"Ready for Main",
	"Blocked",
]);

const value = (input) => (typeof input === "string" ? input.trim() : "");

export const classifyProjectTicketDelivery = (ticket) => {
	const workType = value(ticket.workType);
	const status = value(ticket.status);
	const branch = value(ticket.branch);
	const changeReference = value(ticket.changeReference);

	if (
		workType === "QA" &&
		branch === "staging" &&
		changeReference === "Staging review"
	) {
		return PROJECT_TICKET_DELIVERY_CLASS.verification;
	}

	if (
		new Set(["In Staging", "Ready for Main"]).has(status) ||
		(branch &&
			branch !== "Not created" &&
			!integrationBranches.has(branch) &&
			changeReference !== "Not created") ||
		(branch === "staging" &&
			changeReference &&
			!new Set(["Not created", "Staging review"]).has(changeReference))
	) {
		return PROJECT_TICKET_DELIVERY_CLASS.implementation;
	}

	return PROJECT_TICKET_DELIVERY_CLASS.operational;
};

export const assertHomogeneousProjectTicketBatch = (tickets) => {
	const classifications = new Set(tickets.map(classifyProjectTicketDelivery));
	if (classifications.size <= 1) return;

	throw new Error(
		`Lifecycle batches cannot mix delivery classifications: ${[
			...classifications,
		].join(", ")}.`,
	);
};

export const assertProjectTicketCanStart = (ticket) => {
	if (restartableStatuses.has(value(ticket.status))) return;

	throw new Error(
		`${ticket.taskId} cannot start from ${value(ticket.status) || "an unset status"}; triage it into the correct active state first.`,
	);
};

export const approvedProjectTicketNextAction = (ticket) => {
	const taskId = value(ticket.taskId) || "The approved ticket";
	const branch = value(ticket.branch);
	const changeReference = value(ticket.changeReference);
	const verification = value(ticket.verification);
	const classification = classifyProjectTicketDelivery(ticket);

	if (classification === PROJECT_TICKET_DELIVERY_CLASS.verification) {
		return `Complete ${taskId} directly if current main contains the exact reviewed behavior; otherwise keep it Approved and link its owning implementation ticket. Do not send verification-only work through release promotion.`;
	}
	if (
		classification === PROJECT_TICKET_DELIVERY_CLASS.implementation &&
		!integrationBranches.has(branch) &&
		changeReference === "Uncommitted local review"
	) {
		return `Commit and push the approved changed content on ${branch}, promote that exact responsibility through staging, run the required integrated checks, and move ${taskId} to Ready for Main only after staging passes.`;
	}
	if (
		classification === PROJECT_TICKET_DELIVERY_CLASS.implementation &&
		!integrationBranches.has(branch) &&
		/^Local commit .+; not pushed$/.test(changeReference)
	) {
		return `Push the approved local commit on ${branch}, promote that exact responsibility through staging, run the required integrated checks, and move ${taskId} to Ready for Main only after staging passes.`;
	}
	if (
		classification === PROJECT_TICKET_DELIVERY_CLASS.implementation &&
		branch === "staging" &&
		verification === "Passed"
	) {
		return `Promote the approved verified staging responsibility for ${taskId} to main, run the required post-merge checks, and complete the ticket only after those checks pass.`;
	}

	return `Carry out the approved operational or manual action for ${taskId}, record evidence owned by that ticket, and complete it only when its own completion condition passes.`;
};

export const assertTicketNeutralBatchEvidence = (tickets, evidence) => {
	if (tickets.length <= 1) return;
	const references = [...new Set(value(evidence).match(taskIdPattern) ?? [])];
	if (!references.length) return;

	throw new Error(
		`Shared batch evidence must be ticket-neutral; move ${references.join(
			", ",
		)} into ticket-specific evidence or a documented relationship.`,
	);
};

export const assertStageBatchEligible = (tickets, evidence) => {
	assertHomogeneousProjectTicketBatch(tickets);
	assertTicketNeutralBatchEvidence(tickets, evidence);
	for (const ticket of tickets) {
		if (
			classifyProjectTicketDelivery(ticket) !==
			PROJECT_TICKET_DELIVERY_CLASS.implementation
		) {
			throw new Error(
				`${ticket.taskId} is ${classifyProjectTicketDelivery(ticket)} and cannot enter the implementation release path.`,
			);
		}
		if (
			ticket.status !== "Approved" ||
			integrationBranches.has(ticket.branch)
		) {
			throw new Error(
				`${ticket.taskId} must be an approved dedicated-branch implementation before staging.`,
			);
		}
	}
};

export const assertReadyForMainBatchEligible = (tickets, evidence) => {
	assertHomogeneousProjectTicketBatch(tickets);
	assertTicketNeutralBatchEvidence(tickets, evidence);
	for (const ticket of tickets) {
		if (
			classifyProjectTicketDelivery(ticket) !==
				PROJECT_TICKET_DELIVERY_CLASS.implementation ||
			ticket.status !== "In Staging" ||
			ticket.branch !== "staging"
		) {
			throw new Error(
				`${ticket.taskId} must be an In Staging implementation before Ready for Main.`,
			);
		}
	}
};
