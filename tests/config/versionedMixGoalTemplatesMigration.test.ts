import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260804160000_versioned_mix_goal_templates.sql",
  "utf8",
);

describe("versioned Mix goal templates migration", () => {
  it("separates stable preset identities from immutable reviewed versions", () => {
    expect(migration).toContain(
      "create table public.mix_goal_template_versions",
    );
    expect(migration).toContain(
      "Published Mix goal template versions are immutable.",
    );
    expect(migration).toContain(
      "Targets belonging to published Mix goal template versions are immutable.",
    );
  });

  it("stores explicit goal semantics instead of ambiguous numeric targets", () => {
    for (const goalType of ["exact", "minimum", "maximum", "range"]) {
      expect(migration).toContain(`'${goalType}'`);
    }
    expect(migration).toContain("tolerance_ratio");
    expect(migration).toContain("importance_weight");
    expect(migration).toContain("source_reference");
  });

  it("keeps active goals and reusable personal presets normalized and private", () => {
    expect(migration).toContain("create table public.user_mix_nutrient_goals");
    expect(migration).toContain("create table public.user_mix_goal_templates");
    expect(migration).toContain("template.user_id = auth.uid()");
    expect(migration).toContain("using (user_id = auth.uid())");
  });

  it("uses authenticated RPCs for applying and saving presets", () => {
    for (const functionName of [
      "save_mix_goal_configuration",
      "apply_mix_goal_template",
      "save_user_mix_goal_template",
      "apply_user_mix_goal_template",
      "delete_user_mix_goal_template",
    ]) {
      expect(migration).toContain(`function public.${functionName}`);
    }
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain(
      "Unmodified presets must be applied through their authoritative preset function.",
    );
  });
});
