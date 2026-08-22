export type MixHeaderProps = {
	loadedName?: string | null;
	delightMessage?: string | null;
	isDirty?: boolean;
	canSave: boolean;
	optionsOpen?: boolean;
	onSave: () => void;
	onOpenOptions: () => void;
};
