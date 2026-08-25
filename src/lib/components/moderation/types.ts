export type ModerationActionFeedback = {
	moderationError?: string;
	moderationWarning?: string;
	moderationSuccess?: string;
	productReviewError?: string;
	productReviewSuccess?: string;
	compatibilityReviewError?: string;
	compatibilityReviewSuccess?: string;
	profileImageReviewError?: string;
	profileImageReviewSuccess?: string;
} | null;
