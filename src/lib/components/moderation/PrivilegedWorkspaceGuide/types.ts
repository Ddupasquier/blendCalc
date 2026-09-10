export type PrivilegedWorkspaceGuideTone =
	"attention" | "clear" | "lookup" | "unavailable";

export type PrivilegedWorkspaceGuideProps = {
	tone: PrivilegedWorkspaceGuideTone;
	title: string;
	description: string;
	completion: string;
	count?: number | null;
	countLabel?: string;
};
