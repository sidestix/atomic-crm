import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';

const loadEnvFile = (envPath) => {
    if (!fs.existsSync(envPath)) return;
    const contents = fs.readFileSync(envPath, 'utf-8');
    const lines = contents.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;
        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
};

loadEnvFile(path.resolve(process.cwd(), '.env.development'));

// Get backup prefix or directory from command line argument
// Accepts either: backup-2024-01-15-120000 or full path to backup directory
const backupInput = process.argv[2];
const cliArgs = process.argv.slice(3);

const parseArgs = (args) => {
    const parsed = {
        rewriteUrls: false,
        rewriteFrom: [],
        rewriteTo: null,
    };
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--rewrite-urls') {
            parsed.rewriteUrls = true;
            continue;
        }
        if (arg === '--rewrite-from') {
            const value = args[i + 1];
            if (value) {
                parsed.rewriteFrom.push(...value.split(',').map((entry) => entry.trim()).filter(Boolean));
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--rewrite-from=')) {
            const value = arg.split('=')[1] ?? '';
            parsed.rewriteFrom.push(...value.split(',').map((entry) => entry.trim()).filter(Boolean));
            continue;
        }
        if (arg === '--rewrite-to') {
            const value = args[i + 1];
            if (value) {
                parsed.rewriteTo = value.trim();
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('--rewrite-to=')) {
            const value = arg.split('=')[1] ?? '';
            parsed.rewriteTo = value.trim();
        }
    }
    return parsed;
};

const rewriteOptions = parseArgs(cliArgs);

if (!backupInput) {
    console.error('Error: Backup prefix or directory is required.');
    console.error('Usage: node scripts/restore-database.mjs <backup-prefix-or-directory>');
    console.error('Example: node scripts/restore-database.mjs backup-2024-01-15-120000');
    console.error('Or: node scripts/restore-database.mjs /path/to/backups/backup-2024-01-15-120000');
    console.error('Optional URL rewrite:');
    console.error('  --rewrite-urls --rewrite-from=http://127.0.0.1:54321 --rewrite-to=http://100.110.86.5:54321');
    process.exit(1);
}

if (rewriteOptions.rewriteUrls) {
    if (rewriteOptions.rewriteFrom.length === 0 || !rewriteOptions.rewriteTo) {
        console.error('Error: --rewrite-urls requires --rewrite-from and --rewrite-to.');
        console.error('Example: --rewrite-urls --rewrite-from=http://127.0.0.1:54321 --rewrite-to=http://100.110.86.5:54321');
        process.exit(1);
    }
}

// Determine backup directory and prefix
let backupDir, backupPrefix;
if (path.isAbsolute(backupInput)) {
    // Full path provided - extract directory and prefix
    backupDir = path.dirname(backupInput);
    backupPrefix = path.basename(backupInput);
} else if (backupInput.includes(path.sep)) {
    // Relative path provided
    const resolved = path.resolve(process.cwd(), backupInput);
    backupDir = path.dirname(resolved);
    backupPrefix = path.basename(resolved);
} else {
    // Just prefix provided - use BACKUP_DIR environment variable
    backupDir = process.env.BACKUP_DIR;
    if (!backupDir) {
        console.error('Error: BACKUP_DIR environment variable is not set.');
        console.error('');
        console.error('Set it inline when running the command:');
        console.error('  BACKUP_DIR=/path/to/backups make restore-database BACKUP_PREFIX=backup-2024-01-15-120000');
        console.error('');
        console.error('Or provide the full path:');
        console.error('  make restore-database BACKUP_PREFIX=/path/to/backups/backup-2024-01-15-120000');
        process.exit(1);
    }
    backupPrefix = backupInput;
}

// Construct paths to the backup files
const rolesPath = path.join(backupDir, `${backupPrefix}-roles.sql`);
const schemaPath = path.join(backupDir, `${backupPrefix}-schema.sql`);
const dataPath = path.join(backupDir, `${backupPrefix}-data.sql`);
const attachmentsBackupDir = path.join(backupDir, `${backupPrefix}-attachments`);

// Validate all backup files exist
const missingFiles = [];
if (!fs.existsSync(rolesPath)) missingFiles.push('roles');
if (!fs.existsSync(schemaPath)) missingFiles.push('schema');
if (!fs.existsSync(dataPath)) missingFiles.push('data');

if (missingFiles.length > 0) {
    console.error(`Error: Backup files not found for prefix: ${backupPrefix}`);
    console.error(`Missing files: ${missingFiles.join(', ')}`);
    console.error(`Expected files:`);
    console.error(`  - ${rolesPath}`);
    console.error(`  - ${schemaPath}`);
    console.error(`  - ${dataPath}`);
    process.exit(1);
}

// Check if attachments backup exists (optional)
const hasAttachments = fs.existsSync(attachmentsBackupDir);

// Validate backup files are readable
for (const filePath of [rolesPath, schemaPath, dataPath]) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
    } catch (error) {
        console.error(`Error: Backup file is not readable: ${filePath}`);
        process.exit(1);
    }
}

// Helper function to calculate directory size
let attachmentScanCount = 0;
const attachmentScanLogEvery = 500;
const getDirSize = (dirPath) => {
    if (!fs.existsSync(dirPath)) return 0;
    let totalSize = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += getDirSize(filePath);
            } else {
                totalSize += stats.size;
                attachmentScanCount += 1;
                if (attachmentScanCount % attachmentScanLogEvery === 0) {
                    console.log(`  Scanning attachments: ${attachmentScanCount.toLocaleString()} files...`);
                }
            }
        }
    } catch (error) {
        // Ignore errors reading directory
    }
    return totalSize;
};

const escapeSqlLiteral = (value) => value.replace(/'/g, "''");

const buildRewriteUrlsSQL = (fromValue, toValue) => {
    const escapedFrom = escapeSqlLiteral(fromValue);
    const escapedTo = escapeSqlLiteral(toValue);
    return `
DO $$
DECLARE v_count integer;
BEGIN
    UPDATE public."contactNotes"
    SET attachments = (
        SELECT array_agg(
            CASE
                WHEN elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
                    THEN jsonb_set(elem, '{src}', to_jsonb(replace(elem->>'src', '${escapedFrom}', '${escapedTo}')))
                ELSE elem
            END
        )
        FROM unnest(attachments) AS elem
    )
    WHERE attachments IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(attachments) AS elem
        WHERE elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'contactNotes.attachments updated: %', v_count;

    UPDATE public."dealNotes"
    SET attachments = (
        SELECT array_agg(
            CASE
                WHEN elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
                    THEN jsonb_set(elem, '{src}', to_jsonb(replace(elem->>'src', '${escapedFrom}', '${escapedTo}')))
                ELSE elem
            END
        )
        FROM unnest(attachments) AS elem
    )
    WHERE attachments IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(attachments) AS elem
        WHERE elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'dealNotes.attachments updated: %', v_count;

    UPDATE public."companyNotes"
    SET attachments = (
        SELECT array_agg(
            CASE
                WHEN elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
                    THEN jsonb_set(elem, '{src}', to_jsonb(replace(elem->>'src', '${escapedFrom}', '${escapedTo}')))
                ELSE elem
            END
        )
        FROM unnest(attachments) AS elem
    )
    WHERE attachments IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(attachments) AS elem
        WHERE elem ? 'src' AND elem->>'src' LIKE '${escapedFrom}%'
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'companyNotes.attachments updated: %', v_count;

    UPDATE public.companies
    SET logo = CASE
        WHEN logo ? 'src' AND logo->>'src' LIKE '${escapedFrom}%'
            THEN jsonb_set(logo, '{src}', to_jsonb(replace(logo->>'src', '${escapedFrom}', '${escapedTo}')))
        ELSE logo
    END
    WHERE logo ? 'src' AND logo->>'src' LIKE '${escapedFrom}%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'companies.logo updated: %', v_count;

    UPDATE public.contacts
    SET avatar = CASE
        WHEN avatar ? 'src' AND avatar->>'src' LIKE '${escapedFrom}%'
            THEN jsonb_set(avatar, '{src}', to_jsonb(replace(avatar->>'src', '${escapedFrom}', '${escapedTo}')))
        ELSE avatar
    END
    WHERE avatar ? 'src' AND avatar->>'src' LIKE '${escapedFrom}%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'contacts.avatar updated: %', v_count;

    UPDATE public.sales
    SET avatar = CASE
        WHEN avatar ? 'src' AND avatar->>'src' LIKE '${escapedFrom}%'
            THEN jsonb_set(avatar, '{src}', to_jsonb(replace(avatar->>'src', '${escapedFrom}', '${escapedTo}')))
        ELSE avatar
    END
    WHERE avatar ? 'src' AND avatar->>'src' LIKE '${escapedFrom}%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'sales.avatar updated: %', v_count;
END $$;
`;
};

// Get file stats for display
const rolesStats = fs.statSync(rolesPath);
const schemaStats = fs.statSync(schemaPath);
const dataStats = fs.statSync(dataPath);
const attachmentsSize = hasAttachments ? getDirSize(attachmentsBackupDir) : 0;
const totalSizeMB = ((rolesStats.size + schemaStats.size + dataStats.size + attachmentsSize) / (1024 * 1024)).toFixed(2);
const totalSizeGB = ((rolesStats.size + schemaStats.size + dataStats.size + attachmentsSize) / (1024 * 1024 * 1024)).toFixed(2);
const backupDate = dataStats.mtime.toLocaleString();

console.log('Database and Attachments Restore');
console.log('================================');
console.log(`Backup prefix: ${backupPrefix}`);
console.log(`Backup directory: ${backupDir}`);
console.log(`  - Roles: ${path.basename(rolesPath)} (${(rolesStats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`  - Schema: ${path.basename(schemaPath)} (${(schemaStats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`  - Data: ${path.basename(dataPath)} (${(dataStats.size / (1024 * 1024)).toFixed(2)} MB)`);
if (hasAttachments) {
    console.log(`  - Attachments: ${path.basename(attachmentsBackupDir)} (${(attachmentsSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
}
console.log(`Total size: ${totalSizeGB} GB (${totalSizeMB} MB)`);
console.log(`Date: ${backupDate}`);
console.log('');

// Warning about destructive operation
console.log('⚠️  WARNING: This operation will:');
console.log('   1. Replace the entire database with the backup');
console.log('   2. Replace all attachments with the backup');
console.log('   3. All current data will be lost');
console.log('   4. This cannot be undone!');
if (rewriteOptions.rewriteUrls) {
    console.log('   5. Rewrite stored file URLs');
}
console.log('');

// Confirm before proceeding
const shouldProceed = await confirm({
    message: 'Are you sure you want to proceed with the restore?',
    default: false,
});

if (!shouldProceed) {
    console.log('Restore cancelled.');
    process.exit(0);
}

console.log('\nStarting database restore...');

try {
    // Check if Supabase is running
    try {
        await execa('npx', ['supabase', 'status'], { 
            stdout: 'pipe',
            stderr: 'pipe',
            reject: false // Don't reject on non-zero exit code (warnings cause exit code 1)
        });
    } catch (error) {
        console.error('Error: Supabase does not appear to be running.');
        console.error('Please start Supabase with: make start-supabase or npx supabase start');
        process.exit(1);
    }

    // Use docker exec to run psql inside the Supabase container
    // Container name: supabase_db_atomic-crm(from project_id in config.toml)
    const containerName = 'supabase_db_atomic-crm';
    console.log('✓ Database connection ready');

    // Drop all existing objects in schemas that will be restored
    // This ensures a clean restore even if migrations have already created objects
    // We drop public schema completely, but for auth and storage we only truncate tables
    // since those schemas are managed by Supabase and we can't drop them
    console.log('Step 2: Dropping existing objects...');
    const dropSQL = `
-- Drop all objects in public schema (our app schema)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Truncate auth schema tables (Supabase manages this schema, we can't drop it)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'audit_log_entries') THEN
        TRUNCATE TABLE auth.audit_log_entries CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'flow_state') THEN
        TRUNCATE TABLE auth.flow_state CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        TRUNCATE TABLE auth.users CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
        TRUNCATE TABLE auth.identities CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'instances') THEN
        TRUNCATE TABLE auth.instances CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'sessions') THEN
        TRUNCATE TABLE auth.sessions CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_amr_claims') THEN
        TRUNCATE TABLE auth.mfa_amr_claims CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_factors') THEN
        TRUNCATE TABLE auth.mfa_factors CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_challenges') THEN
        TRUNCATE TABLE auth.mfa_challenges CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'refresh_tokens') THEN
        TRUNCATE TABLE auth.refresh_tokens CASCADE;
    END IF;
END $$;

-- Truncate storage schema tables (Supabase manages this schema, we can't drop it)
-- Only truncate buckets and objects, not system tables
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        TRUNCATE TABLE storage.buckets CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        TRUNCATE TABLE storage.objects CASCADE;
    END IF;
END $$;
`;

    await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
        ],
        {
            input: dropSQL,
            stdio: ['pipe', 'inherit', 'inherit'],
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );
    console.log('✓ Existing objects dropped');

    // Restore using official Supabase approach
    // Following: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
    console.log('Step 3: Restoring from backup files...');
    console.log('  This will restore roles, schema, and data in a single transaction.');
    console.log('  Triggers will be disabled during data restore to prevent conflicts.');
    
    // Use psql via docker exec with proper flags following official Supabase documentation
    // We need to pipe the SQL files into the container
    // --single-transaction: All operations in one transaction (all-or-nothing)
    // --variable ON_ERROR_STOP=1: Stop on first error
    // --command: Set session_replication_role = replica to disable triggers during data restore
    
    // Combine all SQL files into a single input stream
    const rolesContent = fs.readFileSync(rolesPath, 'utf-8');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const dataContent = fs.readFileSync(dataPath, 'utf-8');
    
    // Truncate storage tables before restoring data to avoid conflicts
    // The schema restore may create storage tables with default data
    const truncateStorageSQL = `
-- Truncate storage tables before restoring data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        TRUNCATE TABLE storage.buckets CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        TRUNCATE TABLE storage.objects CASCADE;
    END IF;
END $$;
`;
    
    // Combine SQL files - run everything as postgres (superuser)
    // postgres has all permissions needed for COPY operations on all tables, including storage tables
    const combinedSQL = [
        rolesContent,
        schemaContent,
        truncateStorageSQL,
        'SET session_replication_role = replica;',
        dataContent,
    ].join('\n\n');
    
    // Execute via docker exec, piping SQL through stdin
    await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--single-transaction',
            '--variable', 'ON_ERROR_STOP=1',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
        ],
        {
            input: combinedSQL,
            stdio: ['pipe', 'inherit', 'inherit'],
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );
    
    console.log('✓ Database restore completed');

    // Sync migration history to match backup so migration up only runs newer migrations
    const migrationsPath = path.join(backupDir, `${backupPrefix}-applied-migrations.txt`);
    if (fs.existsSync(migrationsPath)) {
        console.log('Step 3a: Syncing migration history to backup...');
        const content = fs.readFileSync(migrationsPath, 'utf-8');
        const versions = content
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean);
        if (versions.length > 0) {
            const escapedVersions = versions.map((v) => `'${v.replace(/'/g, "''")}'`);
            const syncMigrationsSQL = `TRUNCATE supabase_migrations.schema_migrations;\nINSERT INTO supabase_migrations.schema_migrations (version) VALUES (${escapedVersions.join('), (')});\n`;
            await execa(
                'docker',
                [
                    'exec',
                    '-i',
                    containerName,
                    'psql',
                    '--host=localhost',
                    '--port=5432',
                    '--username=postgres',
                    '--dbname=postgres',
                ],
                {
                    input: syncMigrationsSQL,
                    stdio: ['pipe', 'inherit', 'inherit'],
                    env: { ...process.env, PGPASSWORD: 'postgres' },
                }
            );
            console.log(`✓ Migration history synced to backup (${versions.length} migrations)`);
        } else {
            console.log('  No migration versions in file, skipping.');
        }
    }

    console.log('Step 3b: Re-applying auth user triggers...');
    const { stdout: duplicateSalesUserIds } = await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
            '--tuples-only',
            '--no-align',
            '--command',
            "SELECT user_id::text || '\\t' || COUNT(*)::text FROM public.sales WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;",
        ],
        {
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );
    const duplicateUserIdRows = duplicateSalesUserIds
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean);
    if (duplicateUserIdRows.length > 0) {
        throw new Error(
            `Duplicate sales.user_id values detected (${duplicateUserIdRows.length}). Resolve duplicates before applying auth triggers.`
        );
    }
    const applyTriggerSQL = `
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname IN ('handle_new_user', 'handle_update_user')
          AND pronamespace = 'public'::regnamespace
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
        CREATE TRIGGER on_auth_user_updated
            AFTER UPDATE ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_update_user();
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq__sales__user_id ON public.sales (user_id);
`;
    await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
        ],
        {
            input: applyTriggerSQL,
            stdio: ['pipe', 'inherit', 'inherit'],
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );
    console.log('✓ Auth user triggers re-applied');
    const { stdout: authUserTriggers } = await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
            '--tuples-only',
            '--no-align',
            '--command',
            "SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema='auth' AND event_object_table='users' ORDER BY trigger_name;",
        ],
        {
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );

    console.log('Step 3c: Resetting sequences...');
    const resetSequencesSQL = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
      AND a.attnum > 0
      AND (a.attidentity IN ('a', 'd') OR ad.adrelid IS NOT NULL)
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true);',
      r.seq_name, r.column_name, r.schema_name, r.table_name
    );
  END LOOP;
END $$;
`;
    await execa(
        'docker',
        [
            'exec',
            '-i',
            containerName,
            'psql',
            '--host=localhost',
            '--port=5432',
            '--username=postgres',
            '--dbname=postgres',
        ],
        {
            input: resetSequencesSQL,
            stdio: ['pipe', 'inherit', 'inherit'],
            env: { ...process.env, PGPASSWORD: 'postgres' },
        }
    );
    console.log('✓ Sequences reset');

    if (rewriteOptions.rewriteUrls) {
        for (const fromValue of rewriteOptions.rewriteFrom) {
            console.log(`Step 3d: Rewriting stored file URLs (${fromValue} -> ${rewriteOptions.rewriteTo})...`);
            const rewriteUrlsSQL = buildRewriteUrlsSQL(fromValue, rewriteOptions.rewriteTo);
            await execa(
                'docker',
                [
                    'exec',
                    '-i',
                    containerName,
                    'psql',
                    '--host=localhost',
                    '--port=5432',
                    '--username=postgres',
                    '--dbname=postgres',
                ],
                {
                    input: rewriteUrlsSQL,
                    stdio: ['pipe', 'inherit', 'inherit'],
                    env: { ...process.env, PGPASSWORD: 'postgres' },
                }
            );
            console.log('✓ URL rewrite complete');
        }
    }
    
    // Restore attachments if backup exists
    if (hasAttachments) {
        console.log('\nStep 4: Restoring attachments...');
        const storageContainer = 'supabase_storage_atomic-crm';
        const attachmentsPath = '/mnt/stub/stub/attachments';
        
        // Check if storage container is running
        try {
            const { stdout } = await execa('docker', ['ps', '--filter', `name=${storageContainer}`, '--format', '{{.Names}}']);
            if (!stdout.includes(storageContainer)) {
                console.warn(`⚠️  Warning: Storage container ${storageContainer} is not running. Skipping attachments restore.`);
            } else {
                console.log('  Clearing existing attachments...');
                // Remove existing attachments directory in container
                await execa('docker', ['exec', storageContainer, 'rm', '-rf', attachmentsPath]);
                
                // Recreate the parent directory structure
                await execa('docker', ['exec', storageContainer, 'mkdir', '-p', '/mnt/stub/stub']);
                
                // Get total size for display
                const attachmentsSizeGB = (attachmentsSize / (1024 * 1024 * 1024)).toFixed(2);
                console.log(`  Restoring ${attachmentsSizeGB} GB of attachments...`);

                const backupAttachmentsDir = path.join(attachmentsBackupDir, 'attachments');
                if (!fs.existsSync(backupAttachmentsDir)) {
                    throw new Error(`Attachments directory not found: ${backupAttachmentsDir}`);
                }

                const removeMetadataFiles = (dir) => {
                    const entries = fs.readdirSync(dir);
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            removeMetadataFiles(fullPath);
                        } else if (entry.startsWith('._') || entry === '.DS_Store') {
                            fs.rmSync(fullPath, { force: true });
                        }
                    }
                };
                removeMetadataFiles(backupAttachmentsDir);
                const supabaseUrlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
                const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (!supabaseUrlRaw || !serviceRoleKey) {
                    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required to restore attachments via API.');
                }
                const supabaseUrl = supabaseUrlRaw.replace(/\/$/, '');
                let supabaseHost = null;
                try {
                    supabaseHost = new URL(supabaseUrl).host;
                } catch (error) {
                    supabaseHost = null;
                }
                const attachmentsFiles = [];
                const findFirstFile = (dir) => {
                    const entries = fs.readdirSync(dir);
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            const nested = findFirstFile(fullPath);
                            if (nested) return nested;
                        } else if (!entry.startsWith('._') && entry !== '.DS_Store') {
                            return fullPath;
                        }
                    }
                    return null;
                };
                const entries = fs.readdirSync(backupAttachmentsDir);
                let directoryEntryCount = 0;
                let fileEntryCount = 0;
                const sampleMappings = [];
                for (const entry of entries) {
                    if (entry.startsWith('._') || entry === '.DS_Store') {
                        continue;
                    }
                    const fullPath = path.join(backupAttachmentsDir, entry);
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        directoryEntryCount += 1;
                        const filePath = findFirstFile(fullPath);
                        if (filePath) {
                            attachmentsFiles.push({ fullPath: filePath, relativePath: entry });
                            if (sampleMappings.length < 3) {
                                sampleMappings.push({ objectName: entry });
                            }
                        }
                    } else {
                        fileEntryCount += 1;
                        attachmentsFiles.push({ fullPath, relativePath: entry });
                        if (sampleMappings.length < 3) {
                            sampleMappings.push({ objectName: entry });
                        }
                    }
                }
                const mimeTypes = {
                    '.pdf': 'application/pdf',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml',
                    '.txt': 'text/plain',
                    '.csv': 'text/csv',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.rtf': 'application/rtf',
                };
                let uploadedCount = 0;
                let failedCount = 0;
                let failSampleCount = 0;
                for (const file of attachmentsFiles) {
                    const relativePath = file.relativePath.split(path.sep).join('/');
                    const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
                    const fileExt = path.extname(relativePath).toLowerCase();
                    const contentType = mimeTypes[fileExt] || 'application/octet-stream';
                    const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/${encodedPath}?upsert=true`;
                    const uploadResponse = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${serviceRoleKey}`,
                            apikey: serviceRoleKey,
                            'Content-Type': contentType,
                            'x-upsert': 'true',
                        },
                        body: fs.createReadStream(file.fullPath),
                        duplex: 'half',
                    });
                    if (!uploadResponse.ok) {
                        failedCount += 1;
                        if (failSampleCount < 3) {
                            let errorText = '';
                            try {
                                errorText = await uploadResponse.text();
                            } catch (error) {
                                errorText = '';
                            }
                            failSampleCount += 1;
                        }
                    } else {
                        uploadedCount += 1;
                    }
                    if ((uploadedCount + failedCount) % 500 === 0) {
                        console.log(`  Uploaded ${uploadedCount.toLocaleString()} files...`);
                    }
                }
                if (failedCount > 0) {
                    throw new Error(`Failed to upload ${failedCount} attachment(s).`);
                }
                console.log('✓ Attachments restore completed via API');

                // Verify restore completeness by comparing file lists
                console.log('  Verifying attachments restore completeness...');
                try {
                    // Get list of files from Docker volume
                    const { stdout: dockerFilesStr } = await execa(
                        'docker',
                        ['exec', storageContainer, 'sh', '-c', `find ${attachmentsPath} -type f | sed 's|${attachmentsPath}/||' | sort`]
                    );
                    const dockerFiles = new Set(dockerFilesStr.trim().split('\n').filter(f => f.trim()));
                    
                    // Get list of files from backup (relative to attachments dir)
                    const backupFiles = new Set();
                    const collectBackupFiles = (dir, prefix = '') => {
                        if (!fs.existsSync(dir)) return;
                        const entries = fs.readdirSync(dir);
                        for (const entry of entries) {
                            const fullPath = path.join(dir, entry);
                            const stats = fs.statSync(fullPath);
                            const relativePath = prefix ? `${prefix}/${entry}` : entry;
                            if (stats.isDirectory()) {
                                collectBackupFiles(fullPath, relativePath);
                            } else {
                                const baseName = path.basename(relativePath);
                                if (baseName.startsWith('._') || baseName === '.DS_Store') {
                                    continue;
                                }
                                backupFiles.add(relativePath);
                            }
                        }
                    };
                    collectBackupFiles(backupAttachmentsDir);
                    
                    // Compare file lists
                    const missingInRestore = [];
                    const extraInRestore = [];
                    
                    for (const backupFile of backupFiles) {
                        if (!dockerFiles.has(backupFile)) {
                            missingInRestore.push(backupFile);
                        }
                    }
                    
                    for (const dockerFile of dockerFiles) {
                        if (!backupFiles.has(dockerFile)) {
                            extraInRestore.push(dockerFile);
                        }
                    }
                    
                    if (missingInRestore.length === 0 && extraInRestore.length === 0) {
                        console.log(`    ✓ All ${backupFiles.size.toLocaleString()} files verified`);
                    } else {
                        if (missingInRestore.length > 0) {
                            console.warn(`    ⚠️  Warning: ${missingInRestore.length} file(s) missing from restore:`);
                            missingInRestore.slice(0, 10).forEach(file => {
                                console.warn(`      - ${file}`);
                            });
                            if (missingInRestore.length > 10) {
                                console.warn(`      ... and ${missingInRestore.length - 10} more`);
                            }
                        }
                        if (extraInRestore.length > 0) {
                            console.warn(`    ⚠️  Warning: ${extraInRestore.length} extra file(s) in restore:`);
                            extraInRestore.slice(0, 10).forEach(file => {
                                console.warn(`      - ${file}`);
                            });
                            if (extraInRestore.length > 10) {
                                console.warn(`      ... and ${extraInRestore.length - 10} more`);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`    ⚠️  Warning: Could not verify attachments restore completeness: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('  ✗ Attachments restore failed!');
            console.error(`  ${error.message}`);
            if (error.stderr) {
                console.error(`  Error details: ${error.stderr}`);
            }
            console.error('  Database has been restored, but attachments restore failed.');
            console.error('  You may need to restore attachments manually.');
        }
    }
    
    console.log('\n✓ Restore process completed successfully!');
    console.log('Your database and attachments have been restored from the backup.');
    
} catch (error) {
    console.error('\n✗ Restore failed!');
    console.error(error.message);
    
    if (error.stderr) {
        console.error('\nError details:');
        console.error(error.stderr);
    }
    
    console.error('\n⚠️  Your database may be in an inconsistent state.');
    console.error('You may need to reset it manually: make supabase-reset-database');
    
    process.exit(1);
}
