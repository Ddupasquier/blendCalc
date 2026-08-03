import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const enumMigration = readFileSync(
  "supabase/migrations/20260803100000_add_developer_app_role.sql",
  "utf8",
);
const permissionMigration = readFileSync(
  "supabase/migrations/20260803100100_developer_role_permissions.sql",
  "utf8",
);
const dataHealthMigration = readFileSync(
  "supabase/migrations/20260803100200_developer_data_health_access.sql",
  "utf8",
);

describe("developer application role migrations", () => {
  it("adds the developer enum value in its own committed migration", () => {
    expect(enumMigration).toContain(
      "alter type public.app_role add value if not exists 'developer'",
    );
    expect(enumMigration).not.toContain("app_role_permissions");
  });

  it("maps developer capabilities explicitly and emits the signed claim", () => {
    expect(permissionMigration).toContain(
      "check (role in ('moderator', 'admin', 'developer'))",
    );
    expect(permissionMigration).toContain(
      "select 'developer'::public.app_role, permission.permission",
    );
    expect(permissionMigration).toContain(
      "when 'developer' then 'developer'::public.app_role",
    );
  });

	it("allows the developer role through the independently checked data-health boundary", () => {
		expect(dataHealthMigration).toContain(
			"role_assignment.role in ('moderator', 'admin', 'developer')",
		);
		expect(dataHealthMigration).toContain("errcode = '42501'");
	});
});
