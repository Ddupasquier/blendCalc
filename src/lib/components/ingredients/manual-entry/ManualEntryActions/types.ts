export type ManualEntryActionsProps = {
	onBack: () => void;
	onNext: () => void | Promise<void>;
	nextLabel?: string;
	busy?: boolean;
	nextDisabled?: boolean;
	showBack?: boolean;
};
