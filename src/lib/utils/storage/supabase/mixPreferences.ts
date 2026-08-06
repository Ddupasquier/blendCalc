import {
	getObjectRecord,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
	type CloudDataContext,
	type CloudMixPreferences,
} from "./shared";
import {
  getGoalTemplateSelectionId,
  isMixGoalBasis,
  isMixGoalType,
  normalizeMixGoalMap,
  serializeMixGoals,
  type MixGoalBasis,
  type MixGoalConfiguration,
  type MixGoalMap,
  type MixGoalTemplate,
} from "$lib/utils/mix/goals/types";

const getBooleanRecord = (value: unknown): Record<string, boolean> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
		),
	);
};

export const readCloudMixPreferences = async (
	context?: CloudDataContext,
): Promise<CloudMixPreferences | null> => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

  const [preferenceResult, goalsResult, templatesResult] = await Promise.all([
    supabase
		.from("mix_preferences")
      .select(
        "mix_state, section_order, section_disclosure_state, goal_basis, source_goal_template_version_id, source_user_goal_template_id, goal_configuration_initialized, goal_template_customized",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_mix_nutrient_goals")
      .select(
        "nutrient_id, goal_type, target_amount, upper_amount, tolerance_ratio, importance_weight, sort_order",
      )
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_mix_goal_templates")
      .select(
        "id, display_name, description, goal_basis, source_template_version_id, updated_at",
      )
		.eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (preferenceResult.error || goalsResult.error || templatesResult.error)
    return null;

  const templateIds = (templatesResult.data ?? []).map(
    (template) => template.id,
  );
  const templateTargetsResult =
    templateIds.length > 0
      ? await supabase
          .from("user_mix_goal_template_targets")
          .select(
            "template_id, nutrient_id, goal_type, target_amount, upper_amount, tolerance_ratio, importance_weight, sort_order",
          )
          .in("template_id", templateIds)
          .order("sort_order", { ascending: true })
      : { data: [], error: null };
  if (templateTargetsResult.error) return null;

  const toGoalMap = (
    rows: Array<{
      nutrient_id: number;
      goal_type: string;
      target_amount: number;
      upper_amount: number | null;
      tolerance_ratio: number;
      importance_weight: number;
      sort_order: number;
    }>,
  ): MixGoalMap =>
    Object.fromEntries(
      rows.flatMap((row) => {
        if (!isMixGoalType(row.goal_type)) return [];
        return [
          [
            row.nutrient_id,
            {
              nutrientId: row.nutrient_id,
              goalType: row.goal_type,
              targetAmount: Number(row.target_amount),
              upperAmount:
                row.upper_amount === null ? null : Number(row.upper_amount),
              toleranceRatio: Number(row.tolerance_ratio),
              importanceWeight: Number(row.importance_weight),
              sortOrder: row.sort_order,
            },
          ],
        ] as const;
      }),
    );
  const targetsByTemplate = new Map<
    string,
    typeof templateTargetsResult.data
  >();
  for (const target of templateTargetsResult.data ?? []) {
    const rows = targetsByTemplate.get(target.template_id) ?? [];
    rows.push(target);
    targetsByTemplate.set(target.template_id, rows);
  }
  const userGoalTemplates: MixGoalTemplate[] = (
    templatesResult.data ?? []
  ).flatMap((template) => {
    if (!isMixGoalBasis(template.goal_basis)) return [];
    return [
      {
        id: template.id,
        selectionId: getGoalTemplateSelectionId("user", template.id),
        scope: "user",
        versionId: null,
        version: null,
        label: template.display_name,
        description: template.description,
        goalBasis: template.goal_basis,
        goals: toGoalMap(targetsByTemplate.get(template.id) ?? []),
        sourceKey: null,
        sourceReference: null,
        reviewedAt: null,
        isDefault: false,
      },
    ];
  });
  const data = preferenceResult.data;
  const goalBasis =
    data && isMixGoalBasis(data.goal_basis) ? data.goal_basis : "per_mix";

	return {
    nutrientGoals: toGoalMap(goalsResult.data ?? []),
    hasGoalConfiguration: data?.goal_configuration_initialized ?? false,
    goalBasis,
    sourceGoalTemplateVersionId: data?.source_goal_template_version_id ?? null,
    sourceUserGoalTemplateId: data?.source_user_goal_template_id ?? null,
    goalTemplateCustomized: data?.goal_template_customized ?? true,
    userGoalTemplates,
    mixState: getObjectRecord(data?.mix_state ?? {}),
    sectionOrder: data?.section_order ?? [],
    sectionDisclosureState: getBooleanRecord(data?.section_disclosure_state),
	};
};

export const saveCloudMixPreferences = async (
  { mixState }: Pick<CloudMixPreferences, "mixState">,
  context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("save_mix_preferences", {
		p_mix_state: mixState === undefined ? undefined : toJson(mixState),
	});

	return !error && data === true;
};

export const saveCloudMixGoalConfiguration = async (
  configuration: MixGoalConfiguration,
  context?: CloudDataContext,
): Promise<MixGoalMap | null> => {
  const supabase = resolveCloudClient(context);
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("save_mix_goal_configuration", {
    p_goals: toJson(serializeMixGoals(configuration.goals)),
    p_goal_basis: configuration.goalBasis,
    p_source_template_version_id:
      configuration.sourceTemplateVersionId ?? undefined,
    p_source_user_template_id: configuration.sourceUserTemplateId ?? undefined,
    p_customized: configuration.templateCustomized,
  });
  return error ? null : normalizeMixGoalMap(data, 0);
};

const applyGoalTemplate = async (
  functionName: "apply_mix_goal_template" | "apply_user_mix_goal_template",
  templateId: string,
  keepExtraGoals: boolean,
  context?: CloudDataContext,
): Promise<MixGoalMap | null> => {
  const supabase = resolveCloudClient(context);
  if (!supabase) return null;
  const args =
    functionName === "apply_mix_goal_template"
      ? {
          p_template_version_id: templateId,
          p_keep_extra_goals: keepExtraGoals,
        }
      : { p_template_id: templateId, p_keep_extra_goals: keepExtraGoals };
  const { data, error } = await supabase.rpc(functionName, args);
  return error ? null : normalizeMixGoalMap(data, 0);
};

export const applyCloudMixGoalTemplate = (
  templateVersionId: string,
  keepExtraGoals: boolean,
  context?: CloudDataContext,
) =>
  applyGoalTemplate(
    "apply_mix_goal_template",
    templateVersionId,
    keepExtraGoals,
    context,
  );

export const applyCloudUserMixGoalTemplate = (
  templateId: string,
  keepExtraGoals: boolean,
  context?: CloudDataContext,
) =>
  applyGoalTemplate(
    "apply_user_mix_goal_template",
    templateId,
    keepExtraGoals,
    context,
  );

export const saveCloudUserMixGoalTemplate = async ({
  templateId,
  displayName,
  description,
  goalBasis,
  goals,
  sourceTemplateVersionId,
  context,
}: {
  templateId?: string;
  displayName: string;
  description?: string;
  goalBasis: MixGoalBasis;
  goals: MixGoalMap;
  sourceTemplateVersionId?: string | null;
  context?: CloudDataContext;
}) => {
  const supabase = resolveCloudClient(context);
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("save_user_mix_goal_template", {
    p_template_id: templateId ?? undefined,
    p_display_name: displayName,
    p_description: description ?? "",
    p_goal_basis: goalBasis,
    p_goals: toJson(serializeMixGoals(goals)),
    p_source_template_version_id: sourceTemplateVersionId ?? undefined,
  });
  return error ? null : data;
};

export const deleteCloudUserMixGoalTemplate = async (
  templateId: string,
  context?: CloudDataContext,
) => {
  const supabase = resolveCloudClient(context);
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("delete_user_mix_goal_template", {
    p_template_id: templateId,
  });
  return !error && data === true;
};

export const saveCloudMixSectionOrder = async (
	sectionOrder: string[],
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("save_mix_section_order", {
		p_section_order: sectionOrder,
	});

	return !error && data === true;
};

export const saveCloudMixSectionDisclosureState = async (
	sectionDisclosureState: Record<string, boolean>,
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc(
		"save_mix_section_disclosure_state",
		{
			p_section_disclosure_state: toJson(sectionDisclosureState),
		},
	);

	return !error && data === true;
};
