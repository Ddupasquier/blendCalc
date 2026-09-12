import type { CatalogDataOperationSubject } from "$lib/utils/moderation/profilePrivilegedTools";

export type CatalogDataOperationsWorkListProps = {
	actionCount: number | null;
	actionSubjects: CatalogDataOperationSubject[] | null;
	actionSubjectsTruncated: boolean;
};
