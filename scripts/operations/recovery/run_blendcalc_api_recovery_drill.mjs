/**
 * Purpose: Restore a protected blendCalc backup into disposable local Supabase,
 * migrate it forward, rebuild the isolated blendCalcAPI publication model, and prove rollback.
 * Run: `npm run recovery:blendCalcAPI -- --backup-dir=/absolute/path/to/backup`
 * Legacy backup: add `--legacy-migration-cutoff=<14-digit-version>` only after verifying its schema point.
 */

import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	copyFileSync,
	createReadStream,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
	readCopyRowCounts,
	readMigrationCutoff,
} from "../../lib/recovery/protectedBackup.mjs";

const APP_PROJECT_ID = "bc_api_ops_004_source";
const API_PROJECT_ID = "bc_api_ops_004_target";
const APP_API_PORT = 56321;
const APP_DB_PORT = 56322;
const API_API_PORT = 57321;
const API_DB_PORT = 57322;
const PREVIEW_PORT = 5191;
const SOURCE_EXCLUDES =
	"realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit";
const TARGET_EXCLUDES =
	"gotrue,realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit";
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

const getOption = (name) =>
	process.argv
		.slice(2)
		.find((argument) => argument.startsWith(`${name}=`))
		?.slice(name.length + 1);

const run = (command, arguments_, options = {}) =>
	execFileSync(command, arguments_, {
		cwd: options.cwd,
		env: options.env,
		encoding: options.encoding ?? "utf8",
		stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
	});

const runSupabase = (arguments_, workdir, options = {}) =>
	run("supabase", [...arguments_, "--workdir", workdir], options);

const stopSupabase = (workdir) => {
	try {
		runSupabase(["stop", "--no-backup"], workdir, { stdio: "ignore" });
	} catch {
		// Cleanup is best-effort so a partial local start cannot hide the drill failure.
	}
};

const runPsql = (containerName, sql) =>
	run("docker", [
		"exec",
		containerName,
		"psql",
		"-U",
		"postgres",
		"-d",
		"postgres",
		"-v",
		"ON_ERROR_STOP=1",
		"-At",
		"-c",
		sql,
	]).trim();

const streamDataRestore = (containerName, dataPath) =>
	new Promise((resolveRestore, rejectRestore) => {
		const child = spawn(
			"docker",
			[
				"exec",
				"-i",
				containerName,
				"psql",
				"-U",
				"postgres",
				"-d",
				"postgres",
				"-v",
				"ON_ERROR_STOP=1",
			],
			{ stdio: ["pipe", "ignore", "pipe"] },
		);
		let errorOutput = "";
		child.stderr.on("data", (chunk) => {
			errorOutput += chunk.toString();
		});
		child.on("error", rejectRestore);
		child.on("close", (code) => {
			if (code === 0) resolveRestore();
			else
				rejectRestore(
					new Error(`Database data restore failed: ${errorOutput.trim()}`),
				);
		});
		child.stdin.write(
			"set session_replication_role = replica;\nset statement_timeout = 0;\n",
		);
		const input = createReadStream(dataPath);
		input.on("error", rejectRestore);
		input.on("end", () => {
			child.stdin.end("\nset session_replication_role = origin;\n");
		});
		input.pipe(child.stdin, { end: false });
	});

const replaceTomlField = (config, section, field, value) =>
	config.replace(
		new RegExp(
			`(\\[${section.replace(".", "\\.")}\\][\\s\\S]*?^${field} = )[^\\n]+`,
			"m",
		),
		`$1${value}`,
	);

const createTemporaryConfig = ({
	sourcePath,
	targetPath,
	projectId,
	ports,
	disableSeed,
}) => {
	let config = readFileSync(sourcePath, "utf8").replace(
		/^project_id = ".+"$/m,
		`project_id = "${projectId}"`,
	);
	config = replaceTomlField(config, "api", "port", ports.api);
	config = replaceTomlField(config, "db", "port", ports.db);
	config = replaceTomlField(config, "db", "shadow_port", ports.shadow);
	if (disableSeed) {
		config = config.replace(/(\[db\.seed\][\s\S]*?enabled = )true/, "$1false");
	}
	writeFileSync(targetPath, config, { mode: 0o600 });
};

const listMigrationFiles = (directory) =>
	readdirSync(directory)
		.filter((name) => /^\d{14}_.+\.sql$/.test(name))
		.sort();

const copyMigrations = ({ sourceDirectory, targetDirectory, predicate }) => {
	for (const name of listMigrationFiles(sourceDirectory)) {
		if (predicate(name.slice(0, 14))) {
			copyFileSync(join(sourceDirectory, name), join(targetDirectory, name));
		}
	}
};

const readStatus = (workdir) =>
	JSON.parse(runSupabase(["status", "-o", "json"], workdir));

const truncatePublicTables = (containerName) => {
	runPsql(
		containerName,
		"do $$ declare table_names text; begin select string_agg(format('%I.%I', schemaname, tablename), ', ') into table_names from pg_tables where schemaname = 'public'; if table_names is not null then execute 'truncate table ' || table_names || ' cascade'; end if; end $$;",
	);
};

const createRecoveryAuthPlaceholders = (containerName) =>
	Number(
		runPsql(
			containerName,
			`do $$
declare reference_row record;
begin
	for reference_row in
		select namespace.nspname as schema_name, relation.relname as table_name, attribute.attname as column_name
		from pg_constraint constraint_record
		join pg_class relation on relation.oid = constraint_record.conrelid
		join pg_namespace namespace on namespace.oid = relation.relnamespace
		join pg_attribute attribute on attribute.attrelid = relation.oid and attribute.attnum = constraint_record.conkey[1]
		where constraint_record.contype = 'f'
			and constraint_record.confrelid = 'auth.users'::regclass
			and cardinality(constraint_record.conkey) = 1
			and namespace.nspname = 'public'
	loop
		execute format(
			'insert into auth.users (id, aud, role, email, created_at, updated_at) select distinct %1$I, ''authenticated'', ''authenticated'', ''recovery-placeholder+'' || %1$I::text || ''@invalid'', now(), now() from %2$I.%3$I where %1$I is not null on conflict (id) do nothing',
			reference_row.column_name,
			reference_row.schema_name,
			reference_row.table_name
		);
	end loop;
end
$$;
select count(*) from auth.users where email like 'recovery-placeholder+%@invalid';`,
		)
			.split("\n")
			.at(-1),
	);

const assertForeignKeys = (containerName) => {
	runPsql(
		containerName,
		`do $$
declare foreign_key record;
declare join_expression text;
declare required_expression text;
declare has_orphan boolean;
begin
	for foreign_key in
		select constraint_record.oid, constraint_record.conname, source_namespace.nspname as source_schema,
			source_relation.relname as source_table, target_namespace.nspname as target_schema,
			target_relation.relname as target_table
		from pg_constraint constraint_record
		join pg_class source_relation on source_relation.oid = constraint_record.conrelid
		join pg_namespace source_namespace on source_namespace.oid = source_relation.relnamespace
		join pg_class target_relation on target_relation.oid = constraint_record.confrelid
		join pg_namespace target_namespace on target_namespace.oid = target_relation.relnamespace
		where constraint_record.contype = 'f' and source_namespace.nspname = 'public'
	loop
		select string_agg(format('source.%I = target.%I', source_attribute.attname, target_attribute.attname), ' and ' order by key_column.ordinality),
			string_agg(format('source.%I is not null', source_attribute.attname), ' and ' order by key_column.ordinality)
		into join_expression, required_expression
		from pg_constraint constraint_record
		cross join lateral unnest(constraint_record.conkey, constraint_record.confkey) with ordinality as key_column(source_number, target_number, ordinality)
		join pg_attribute source_attribute on source_attribute.attrelid = constraint_record.conrelid and source_attribute.attnum = key_column.source_number
		join pg_attribute target_attribute on target_attribute.attrelid = constraint_record.confrelid and target_attribute.attnum = key_column.target_number
		where constraint_record.oid = foreign_key.oid;
		execute format(
			'select exists (select 1 from %I.%I source where %s and not exists (select 1 from %I.%I target where %s))',
			foreign_key.source_schema, foreign_key.source_table, required_expression,
			foreign_key.target_schema, foreign_key.target_table, join_expression
		) into has_orphan;
		if has_orphan then
			raise exception 'Foreign-key validation failed for %.% constraint %', foreign_key.source_schema, foreign_key.source_table, foreign_key.conname;
		end if;
	end loop;
end
$$;`,
	);
};

const readRestoredCounts = (containerName, expectedCounts) => {
	const selections = [...expectedCounts.keys()].map((tableName) => {
		if (!IDENTIFIER_PATTERN.test(tableName))
			throw new Error(`Unsafe table identifier: ${tableName}`);
		return `select '${tableName}' as table_name, count(*)::bigint as row_count from public.${tableName}`;
	});
	const output = runPsql(containerName, selections.join(" union all "));
	const actualCounts = new Map(
		output
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [tableName, count] = line.split("|");
				return [tableName, Number(count)];
			}),
	);
	for (const [tableName, expected] of expectedCounts) {
		if (actualCounts.get(tableName) !== expected) {
			throw new Error(`Restored row count differs for public.${tableName}.`);
		}
	}
	return [...actualCounts.values()].reduce((total, count) => total + count, 0);
};

const restoreStorage = async ({ backupDirectory, manifest, status }) => {
	const supabase = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	for (const bucket of manifest.buckets ?? []) {
		const settings = {
			public: Boolean(bucket.public),
			fileSizeLimit: bucket.fileSizeLimit ?? undefined,
			allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
		};
		const existing = await supabase.storage.getBucket(bucket.name);
		const result = existing.data
			? await supabase.storage.updateBucket(bucket.name, settings)
			: await supabase.storage.createBucket(bucket.name, settings);
		if (result.error) throw result.error;
	}
	for (const object of manifest.objects ?? []) {
		const bucketName = object.bucket ?? object.bucketId;
		const objectPath = object.path ?? object.objectPath;
		const localPath = resolve(
			backupDirectory,
			"storage",
			bucketName,
			objectPath,
		);
		const upload = await supabase.storage
			.from(bucketName)
			.upload(objectPath, readFileSync(localPath), {
				upsert: true,
				contentType: object.contentType ?? "application/octet-stream",
				cacheControl: object.cacheControl ?? undefined,
			});
		if (upload.error) throw upload.error;
		const restored = await supabase.storage
			.from(bucketName)
			.download(objectPath);
		if (restored.error || !restored.data)
			throw (
				restored.error ?? new Error("Restored Storage object is unavailable.")
			);
		const bytes = Buffer.from(await restored.data.arrayBuffer());
		if (bytes.byteLength !== (object.sizeBytes ?? object.bytes)) {
			throw new Error(
				`Restored Storage size differs for ${bucketName}/${objectPath}.`,
			);
		}
		const restoredHash = createHash("sha256").update(bytes).digest("hex");
		if (restoredHash !== object.sha256) {
			throw new Error(
				`Restored Storage hash differs for ${bucketName}/${objectPath}.`,
			);
		}
	}
};

const waitForServer = async (url, child) => {
	for (let attempt = 0; attempt < 120; attempt += 1) {
		if (child.exitCode !== null)
			throw new Error("Recovery preview server stopped before becoming ready.");
		try {
			const response = await fetch(url);
			if (response.status < 500) return;
		} catch {
			// The preview server is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 500));
	}
	throw new Error("Recovery preview server did not become ready.");
};

const cloneActiveGeneration = (containerName) =>
	runPsql(
		containerName,
		`do $$
declare source_id uuid;
declare clone_id uuid := gen_random_uuid();
begin
	select id into source_id from blendcalc_api.publication_generations where status = 'active';
	insert into blendcalc_api.publication_generations (
		id, source_project_ref, source_catalog_hash, expected_product_count, expected_revision_count,
		expected_category_count, expected_attribution_count, source_snapshot_at
	)
	select clone_id, source_project_ref, source_catalog_hash, expected_product_count, expected_revision_count,
		expected_category_count, expected_attribution_count, source_snapshot_at
	from blendcalc_api.publication_generations where id = source_id;
	insert into blendcalc_api.publication_products (
		generation_id, source_product_id, source_revision_id, gtin14, product_name, brand_owner,
		category_key, search_text, detail_payload, search_payload, content_sha256, source_updated_at,
		category_search_text
	)
	select clone_id, source_product_id, source_revision_id, gtin14, product_name, brand_owner,
		category_key, search_text, detail_payload, search_payload, content_sha256, source_updated_at,
		category_search_text
	from blendcalc_api.publication_products where generation_id = source_id;
	insert into blendcalc_api.publication_product_revisions select clone_id, gtin14, source_revision_id, revision_number, published_at, revision_payload, content_sha256 from blendcalc_api.publication_product_revisions where generation_id = source_id;
	insert into blendcalc_api.publication_categories select clone_id, category_key, display_name, sort_order, category_payload, content_sha256 from blendcalc_api.publication_categories where generation_id = source_id;
	insert into blendcalc_api.publication_source_attributions select clone_id, source_key, attribution_payload, content_sha256 from blendcalc_api.publication_source_attributions where generation_id = source_id;
	perform blendcalc_api.mark_publication_generation_ready(clone_id);
	perform blendcalc_api.activate_publication_generation(clone_id);
end
$$;
select id from blendcalc_api.publication_generations where status = 'active';`,
	);

const runPublicationExercise = async ({
	repositoryRoot,
	appStatus,
	targetStatus,
	targetContainer,
}) => {
	const buildEnvironment = {
		...process.env,
		PUBLIC_SUPABASE_URL: appStatus.API_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: appStatus.PUBLISHABLE_KEY,
		SUPABASE_SERVICE_ROLE_KEY: appStatus.SERVICE_ROLE_KEY,
		BLENDCALC_API_SUPABASE_URL: targetStatus.API_URL,
		BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY: targetStatus.SERVICE_ROLE_KEY,
		BLENDCALC_API_READ_MODE: "isolated",
		CRON_SECRET: randomBytes(24).toString("hex"),
	};
	run("npm", ["run", "build"], {
		cwd: repositoryRoot,
		env: buildEnvironment,
		stdio: "inherit",
	});
	const preview = spawn(
		"npm",
		[
			"run",
			"preview",
			"--",
			"--host",
			"127.0.0.1",
			"--port",
			String(PREVIEW_PORT),
			"--strictPort",
		],
		{
			cwd: repositoryRoot,
			env: buildEnvironment,
			stdio: ["ignore", "ignore", "pipe"],
		},
	);
	let previewError = "";
	preview.stderr.on("data", (chunk) => {
		previewError += chunk.toString();
	});
	try {
		const syncUrl = `http://127.0.0.1:${PREVIEW_PORT}/api/internal/blendCalcAPI/publication/sync`;
		await waitForServer(
			`http://127.0.0.1:${PREVIEW_PORT}/api/v1/categories?limit=1`,
			preview,
		);
		const headers = { authorization: `Bearer ${buildEnvironment.CRON_SECRET}` };
		const syncResponse = await fetch(syncUrl, { headers });
		if (!syncResponse.ok)
			throw new Error(
				`Publication synchronization returned HTTP ${syncResponse.status}.`,
			);
		const synchronization = await syncResponse.json();
		if (synchronization.action !== "created" || !synchronization.generationId) {
			throw new Error(
				"Publication synchronization did not create a recovery generation.",
			);
		}
		const activeBeforeClone = synchronization.generationId;
		const clonedGeneration = cloneActiveGeneration(targetContainer);
		if (!clonedGeneration || clonedGeneration === activeBeforeClone) {
			throw new Error(
				"Recovery rollback setup did not activate a distinct generation.",
			);
		}
		const rollbackResponse = await fetch(syncUrl, {
			method: "POST",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify({ action: "rollback" }),
		});
		if (!rollbackResponse.ok)
			throw new Error(
				`Publication rollback returned HTTP ${rollbackResponse.status}.`,
			);
		const rollback = await rollbackResponse.json();
		if (
			rollback.action !== "rolled-back" ||
			rollback.generationId !== activeBeforeClone
		) {
			throw new Error(
				"Publication rollback did not restore the verified generation.",
			);
		}
		return synchronization;
	} catch (error) {
		if (previewError.trim()) console.error(previewError.trim());
		throw error;
	} finally {
		preview.kill("SIGTERM");
	}
};

export const runRecoveryDrill = async () => {
	const repositoryRoot = resolve(
		fileURLToPath(new URL("../../..", import.meta.url)),
	);
	const backupDirectory = resolve(getOption("--backup-dir") ?? "");
	if (!getOption("--backup-dir") || !isAbsolute(getOption("--backup-dir"))) {
		throw new Error("Pass --backup-dir=/absolute/path/to/a/protected/backup.");
	}
	const legacyCutoff = getOption("--legacy-migration-cutoff");
	const { migrationCutoff, migrationVersions, usedLegacyCutoff } =
		readMigrationCutoff(backupDirectory, legacyCutoff);
	const localMigrationFiles = listMigrationFiles(
		join(repositoryRoot, "supabase/migrations"),
	);
	const localVersions = localMigrationFiles.map((name) => name.slice(0, 14));
	if (!localVersions.includes(migrationCutoff)) {
		throw new Error(
			`Backup migration cutoff ${migrationCutoff} is not present locally.`,
		);
	}
	if (
		migrationVersions &&
		migrationVersions.some((version) => !localVersions.includes(version))
	) {
		throw new Error(
			"The backup migration history cannot be reconstructed from this checkout.",
		);
	}
	run(
		"node",
		[
			join(
				repositoryRoot,
				"scripts/operations/recovery/verify_protected_hosted_backup.mjs",
			),
			backupDirectory,
		],
		{
			cwd: repositoryRoot,
			stdio: "inherit",
		},
	);
	const expectedCounts = await readCopyRowCounts(
		join(backupDirectory, "public-data.sql"),
	);
	const storageManifest = JSON.parse(
		readFileSync(join(backupDirectory, "storage-manifest.json"), "utf8"),
	);
	const temporaryRoot = mkdtempSync(join(tmpdir(), "blendcalc-recovery-"));
	const appWorkdir = join(temporaryRoot, "app");
	const targetWorkdir = join(temporaryRoot, "api");
	const appSupabase = join(appWorkdir, "supabase");
	const targetSupabase = join(targetWorkdir, "supabase");
	const appMigrations = join(appSupabase, "migrations");
	const targetMigrations = join(targetSupabase, "migrations");
	mkdirSync(appMigrations, { recursive: true, mode: 0o700 });
	mkdirSync(targetMigrations, { recursive: true, mode: 0o700 });
	createTemporaryConfig({
		sourcePath: join(repositoryRoot, "supabase/config.toml"),
		targetPath: join(appSupabase, "config.toml"),
		projectId: APP_PROJECT_ID,
		ports: { api: APP_API_PORT, db: APP_DB_PORT, shadow: APP_DB_PORT - 2 },
		disableSeed: true,
	});
	createTemporaryConfig({
		sourcePath: join(
			repositoryRoot,
			"infrastructure/blendCalcAPI/supabase/config.toml",
		),
		targetPath: join(targetSupabase, "config.toml"),
		projectId: API_PROJECT_ID,
		ports: { api: API_API_PORT, db: API_DB_PORT, shadow: API_DB_PORT - 2 },
		disableSeed: true,
	});
	copyMigrations({
		sourceDirectory: join(repositoryRoot, "supabase/migrations"),
		targetDirectory: appMigrations,
		predicate: (version) => version <= migrationCutoff,
	});
	copyMigrations({
		sourceDirectory: join(
			repositoryRoot,
			"infrastructure/blendCalcAPI/supabase/migrations",
		),
		targetDirectory: targetMigrations,
		predicate: () => true,
	});
	try {
		stopSupabase(appWorkdir);
		stopSupabase(targetWorkdir);
		runSupabase(["start", "--exclude", SOURCE_EXCLUDES, "--yes"], appWorkdir);
		runSupabase(
			["start", "--exclude", TARGET_EXCLUDES, "--yes"],
			targetWorkdir,
		);
		const appContainer = `supabase_db_${APP_PROJECT_ID}`;
		const targetContainer = `supabase_db_${API_PROJECT_ID}`;
		truncatePublicTables(appContainer);
		await streamDataRestore(
			appContainer,
			join(backupDirectory, "public-data.sql"),
		);
		const restoredRows = readRestoredCounts(appContainer, expectedCounts);
		const placeholderUsers = createRecoveryAuthPlaceholders(appContainer);
		assertForeignKeys(appContainer);
		copyMigrations({
			sourceDirectory: join(repositoryRoot, "supabase/migrations"),
			targetDirectory: appMigrations,
			predicate: (version) => version > migrationCutoff,
		});
		runSupabase(["migration", "up", "--local"], appWorkdir, {
			stdio: "inherit",
		});
		assertForeignKeys(appContainer);
		const appStatus = readStatus(appWorkdir);
		const targetStatus = {
			...readStatus(targetWorkdir),
			SERVICE_ROLE_KEY: appStatus.SERVICE_ROLE_KEY,
		};
		await restoreStorage({
			backupDirectory,
			manifest: storageManifest,
			status: appStatus,
		});
		const canonicalCounts = runPsql(
			appContainer,
			"select json_build_object('products', (select count(*) from public.shared_products), 'revisions', (select count(*) from public.shared_product_revisions), 'observations', (select count(*) from public.shared_product_observations), 'images', (select count(*) from public.food_image_assets))::text;",
		);
		const canonical = JSON.parse(canonicalCounts);
		if (Object.values(canonical).some((count) => Number(count) <= 0)) {
			throw new Error(
				"The restored canonical catalog is missing products, revisions, observations, or images.",
			);
		}
		const publication = await runPublicationExercise({
			repositoryRoot,
			appStatus,
			targetStatus,
			targetContainer,
		});
		console.log("blendCalcAPI recovery drill passed.");
		console.log(
			JSON.stringify(
				{
					migrationCutoff,
					usedLegacyCutoff,
					restoredPublicTables: expectedCounts.size,
					restoredPublicRows: restoredRows,
					recoveryAuthPlaceholders: placeholderUsers,
					restoredStorageObjects: storageManifest.objects?.length ?? 0,
					canonical,
					publication: {
						catalogHash: publication.catalogHash,
						counts: publication.counts,
						rollbackVerified: true,
					},
				},
				null,
				2,
			),
		);
	} finally {
		stopSupabase(targetWorkdir);
		stopSupabase(appWorkdir);
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
	runRecoveryDrill().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
