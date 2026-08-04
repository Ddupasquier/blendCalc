export type MixHeaderProps = {
	loadedName?: string | null;
	isDirty?: boolean;
	canSave: boolean;
	optionsOpen?: boolean;
	onSave: () => void;
	onOpenOptions: () => void;
};
