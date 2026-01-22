import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';

// Get backup prefix or directory from command line argument
// Accepts either: backup-2024-01-15-120000 or full path to backup directory
const backupInput = process.argv[2];

if (!backupInput) {
    console.error('Error: Backup prefix or directory is required.');
    console.error('Usage: node scripts/restore-database.mjs <backup-prefix-or-directory>');
    console.error('Example: node scripts/restore-database.mjs backup-2024-01-15-120000');
    console.error('Or: node scripts/restore-database.mjs /path/to/backups/backup-2024-01-15-120000');
    process.exit(1);
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
            }
        }
    } catch (error) {
        // Ignore errors reading directory
    }
    return totalSize;
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
    // Container name: supabase_db_atomic-crm-demo (from project_id in config.toml)
    const containerName = 'supabase_db_atomic-crm-demo';
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
    
    // Restore attachments if backup exists
    if (hasAttachments) {
        console.log('\nStep 4: Restoring attachments...');
        const storageContainer = 'supabase_storage_atomic-crm-demo';
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

                // Use docker cp for simple, reliable file copying
                const progressIntervalMs = 5000;
                let progressInFlight = false;
                const logRestoreProgress = async () => {
                    if (progressInFlight) return;
                    progressInFlight = true;
                    try {
                        const { stdout: currentSizeStr } = await execa(
                            'docker',
                            ['exec', storageContainer, 'sh', '-c', `du -sb ${attachmentsPath} 2>/dev/null | cut -f1 || echo 0`]
                        );
                        const currentSize = parseInt(currentSizeStr.trim(), 10) || 0;
                        const currentSizeGB = (currentSize / (1024 * 1024 * 1024)).toFixed(2);
                        const percent = attachmentsSize > 0 ? ((currentSize / attachmentsSize) * 100).toFixed(1) : '0.0';
                        console.log(`  Progress: ${percent}% (${currentSizeGB} GB / ${attachmentsSizeGB} GB)`);
                    } catch (error) {
                        // Ignore errors in progress monitoring
                    } finally {
                        progressInFlight = false;
                    }
                };
                const progressTimer = setInterval(logRestoreProgress, progressIntervalMs);
                await logRestoreProgress();
                try {
                    // Normalize path for Docker on Windows - convert to forward slashes and ensure absolute path
                    const normalizedBackupPath = path.resolve(backupAttachmentsDir).replace(/\\/g, '/');
                    await execa(
                        'docker',
                        ['cp', normalizedBackupPath, `${storageContainer}:${attachmentsPath}`]
                    );
                } finally {
                    clearInterval(progressTimer);
                }
                
                console.log('✓ Attachments restore completed');

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
