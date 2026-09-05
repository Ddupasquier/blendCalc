export type PhotoUploadCapture = "user" | "environment";

export type PhotoUploadInputProps = {
	id: string;
	name: string;
	prompt: string;
	description: string;
	photoCount?: number;
	files?: readonly File[];
	accept?: string;
	capture?: PhotoUploadCapture;
	required?: boolean;
	disabled?: boolean;
	onFilesChange?: (files: File[]) => void;
};
