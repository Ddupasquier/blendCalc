export type PhotoUploadCapture = "user" | "environment";
export type PhotoUploadStatus =
	"preparing" | "ready" | "uploading" | "uploaded" | "needs-attention";

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
	status?: PhotoUploadStatus;
	progress?: number | null;
	onFilesChange?: (files: File[]) => void;
};
