import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';

const BACKUP_DIR = process.env.BACKUP_DIR;
const RETENTION_DAYS = 7;

if (!BACKUP_DIR) {
    console.error('Error: BACKUP_DIR environment variable is not set.');
    console.error('');
    console.error('Set it inline when running the command:');
    console.error('  BACKUP_DIR=/path/to/backups make backup-database');
    console.error('');
    console.error('Example:');
    console.error('  BACKUP_DIR=/Users/kelly/atomic-crm-backups make backup-database');
    process.exit(1);
}

// Validate backup directory
if (!fs.existsSync(BACKUP_DIR)) {
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`Created backup directory: ${BACKUP_DIR}`);
    } catch (error) {
        console.error(`Error: Failed to create backup directory: ${BACKUP_DIR}`);
        console.error(error.message);
        process.exit(1);
    }
}

// Check if directory is writable
try {
    fs.accessSync(BACKUP_DIR, fs.constants.W_OK);
} catch (error) {
    console.error(`Error: Backup directory is not writable: ${BACKUP_DIR}`);
    process.exit(1);
}

// Helper function to calculate directory size recursively
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

// Generate backup filenames with timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPrefix = `backup-${timestamp}`;
const rolesPath = path.join(BACKUP_DIR, `${backupPrefix}-roles.sql`);
const schemaPath = path.join(BACKUP_DIR, `${backupPrefix}-schema.sql`);
const dataPath = path.join(BACKUP_DIR, `${backupPrefix}-data.sql`);
const attachmentsBackupDir = path.join(BACKUP_DIR, `${backupPrefix}-attachments`);

console.log(`Starting database and attachments backup...`);
console.log(`Backup files will be saved to: ${BACKUP_DIR}`);
console.log(`  - Roles: ${path.basename(rolesPath)}`);
console.log(`  - Schema: ${path.basename(schemaPath)}`);
console.log(`  - Data: ${path.basename(dataPath)}`);
console.log(`  - Attachments: ${path.basename(attachmentsBackupDir)}`);

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

    // Create backup using supabase db dump --local
    // Following official Supabase documentation: create separate files for roles, schema, and data
    
    // Dump roles
    console.log('Dumping database roles...');
    await execa(
        'npx',
        [
            'supabase',
            'db',
            'dump',
            '--local',
            '--file',
            rolesPath,
            '--role-only',
        ],
        {
            stdio: 'inherit',
        }
    );
    
    // Dump schema
    console.log('Dumping database schema...');
    await execa(
        'npx',
        [
            'supabase',
            'db',
            'dump',
            '--local',
            '--file',
            schemaPath,
        ],
        {
            stdio: 'inherit',
        }
    );
    
    // Dump data with --use-copy flag for efficient bulk loading
    console.log('Dumping database data...');
    await execa(
        'npx',
        [
            'supabase',
            'db',
            'dump',
            '--local',
            '--file',
            dataPath,
            '--data-only',
            '--use-copy',
        ],
        {
            stdio: 'inherit',
        }
    );
    
    // Filter out Supabase system tables from the data dump
    // Keep: all public schema tables, storage.buckets, storage.objects
    // Exclude: storage system tables (buckets_vectors, vector_indexes, etc.)
    console.log('Filtering out Supabase system tables...');
    const dataContent = fs.readFileSync(dataPath, 'utf-8');
    const systemTablesToExclude = [
        'buckets_vectors',
        'vector_indexes',
        'iceberg_namespaces',
        'iceberg_tables',
        'buckets_analytics',
        'prefixes',
        's3_multipart_uploads',
        's3_multipart_uploads_parts',
    ];
    
    // Split content into sections (each table has a section starting with "-- Data for Name:")
    const lines = dataContent.split('\n');
    const filteredLines = [];
    let skipSection = false;
    let currentTable = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this is the start of a new table section
        const tableMatch = line.match(/^-- Data for Name: ([^;]+); Type: TABLE DATA; Schema: storage;/);
        if (tableMatch) {
            currentTable = tableMatch[1].trim();
            // Check if this is a system table we want to exclude
            if (systemTablesToExclude.includes(currentTable)) {
                skipSection = true;
                continue; // Skip the header line
            }
            // If it's storage.buckets or storage.objects, or any public schema table, keep it
            skipSection = false;
            filteredLines.push(line);
            continue;
        }
        
        // If we're in a section to skip, continue until we hit the end of this table's COPY block
        if (skipSection) {
            // Check if we've reached the end of this table's COPY block
            // The COPY block ends with a line containing only "\." (backslash-dot)
            if (line === '\\.' || line.trim() === '\\.') {
                // After the "\." line, check if next non-empty line starts a new table section
                // If so, we'll stop skipping on the next iteration
                let j = i + 1;
                while (j < lines.length && lines[j].trim() === '') {
                    j++;
                }
                if (j < lines.length && lines[j].startsWith('-- Data for Name:')) {
                    // Next iteration will see the new table header and set skipSection = false
                    skipSection = false;
                }
            }
            continue; // Skip this line
        }
        
        // Keep this line
        filteredLines.push(line);
    }
    
    // Write the filtered content back
    fs.writeFileSync(dataPath, filteredLines.join('\n'), 'utf-8');
    console.log(`✓ Filtered out ${systemTablesToExclude.length} Supabase system table(s)`);

    // Dump applied migration versions so restore can sync migration history
    const dbContainerName = 'supabase_db_atomic-crm';
    const migrationsPath = path.join(BACKUP_DIR, `${backupPrefix}-applied-migrations.txt`);
    try {
        console.log('Dumping applied migrations...');
        const { stdout: migrationsOutput } = await execa(
            'docker',
            [
                'exec',
                dbContainerName,
                'psql',
                '--host=localhost',
                '--port=5432',
                '--username=postgres',
                '--dbname=postgres',
                '-t',
                '-A',
                '-c',
                'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;',
            ],
            { env: { ...process.env, PGPASSWORD: 'postgres' } }
        );
        const versions = migrationsOutput
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean);
        fs.writeFileSync(migrationsPath, versions.join('\n'), 'utf-8');
        console.log(`✓ Applied migrations saved (${versions.length} migrations)`);
    } catch (migrationsError) {
        console.warn(`⚠️  Could not dump applied migrations: ${migrationsError.message}`);
        console.warn('  Restore will not sync migration history; run migration up after restore if needed.');
    }

    // Backup attachments
    console.log('\nBacking up attachments...');
    const storageContainer = 'supabase_storage_atomic-crm';
    const attachmentsPath = '/mnt/stub/stub/attachments';
    
    // Check if storage container is running
    try {
        const { stdout } = await execa('docker', ['ps', '--filter', `name=${storageContainer}`, '--format', '{{.Names}}']);
        if (!stdout.includes(storageContainer)) {
            console.warn(`⚠️  Warning: Storage container ${storageContainer} is not running. Skipping attachments backup.`);
        } else {
            // Check if attachments directory exists in container
            try {
                await execa('docker', ['exec', storageContainer, 'test', '-d', attachmentsPath]);
                
                // Create backup directory
                if (!fs.existsSync(attachmentsBackupDir)) {
                    fs.mkdirSync(attachmentsBackupDir, { recursive: true });
                }

                // Count files and get total size for progress indication
                console.log('  Analyzing attachments...');
                const { stdout: fileCount } = await execa(
                    'docker',
                    ['exec', storageContainer, 'sh', '-c', `find ${attachmentsPath} -type f | wc -l`]
                );
                const numFiles = parseInt(fileCount.trim(), 10) || 0;
                
                // Get total size for progress calculation
                const { stdout: totalSizeStr } = await execa(
                    'docker',
                    ['exec', storageContainer, 'sh', '-c', `du -sb ${attachmentsPath} 2>/dev/null | cut -f1`]
                );
                const totalSize = parseInt(totalSizeStr.trim(), 10) || 0;
                const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
                
                console.log(`  Found ${numFiles.toLocaleString()} files (${totalSizeGB} GB total)`);
                
                console.log('  Copying attachments...');

                // Use docker cp for simple, reliable file copying
                const progressIntervalMs = 5000;
                const logCopyProgress = () => {
                    const currentSize = getDirSize(attachmentsBackupDir);
                    const currentSizeGB = (currentSize / (1024 * 1024 * 1024)).toFixed(2);
                    const percent = totalSize > 0 ? ((currentSize / totalSize) * 100).toFixed(1) : '0.0';
                    console.log(`  Progress: ${percent}% (${currentSizeGB} GB / ${totalSizeGB} GB)`);
                };
                let progressTimer = setInterval(logCopyProgress, progressIntervalMs);
                logCopyProgress();
                try {
                    await execa(
                        'docker',
                        ['cp', `${storageContainer}:${attachmentsPath}`, attachmentsBackupDir]
                    );
                } finally {
                    clearInterval(progressTimer);
                    progressTimer = null;
                }

                // Calculate attachments backup size
                const attachmentsSize = getDirSize(attachmentsBackupDir);
                const attachmentsSizeGB = (attachmentsSize / (1024 * 1024 * 1024)).toFixed(2);
                const attachmentsSizeMB = (attachmentsSize / (1024 * 1024)).toFixed(2);

                console.log(`  ✓ Attachments backup completed!`);
                console.log(`    Files: ${numFiles.toLocaleString()}`);
                console.log(`    Size: ${attachmentsSizeGB} GB (${attachmentsSizeMB} MB)`);
                
                // Verify backup completeness by comparing file lists
                console.log('  Verifying backup completeness...');
                try {
                    // Get list of files from Docker volume
                    const { stdout: dockerFilesStr } = await execa(
                        'docker',
                        ['exec', storageContainer, 'sh', '-c', `find ${attachmentsPath} -type f | sed 's|${attachmentsPath}/||' | sort`]
                    );
                    const dockerFiles = new Set(dockerFilesStr.trim().split('\n').filter(f => f.trim()));
                    
                    // Get list of files from backup (remove 'attachments/' prefix)
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
                                // Remove the 'attachments/' prefix from backup paths to match Docker paths
                                const normalizedPath = relativePath.replace(/^attachments\//, '');
                                const baseName = path.basename(normalizedPath);
                                if (baseName.startsWith('._') || baseName === '.DS_Store') {
                                    continue;
                                }
                                backupFiles.add(normalizedPath);
                            }
                        }
                    };
                    collectBackupFiles(attachmentsBackupDir);
                    
                    // Compare file lists
                    const missingInBackup = [];
                    const extraInBackup = [];
                    
                    for (const dockerFile of dockerFiles) {
                        if (!backupFiles.has(dockerFile)) {
                            missingInBackup.push(dockerFile);
                        }
                    }
                    
                    for (const backupFile of backupFiles) {
                        if (!dockerFiles.has(backupFile)) {
                            extraInBackup.push(backupFile);
                        }
                    }
                    
                    if (missingInBackup.length === 0 && extraInBackup.length === 0) {
                        console.log(`    ✓ All ${dockerFiles.size.toLocaleString()} files verified`);
                    } else {
                        if (missingInBackup.length > 0) {
                            console.warn(`    ⚠️  Warning: ${missingInBackup.length} file(s) missing from backup:`);
                            missingInBackup.slice(0, 10).forEach(file => {
                                console.warn(`      - ${file}`);
                            });
                            if (missingInBackup.length > 10) {
                                console.warn(`      ... and ${missingInBackup.length - 10} more`);
                            }
                        }
                        if (extraInBackup.length > 0) {
                            console.warn(`    ⚠️  Warning: ${extraInBackup.length} extra file(s) in backup:`);
                            extraInBackup.slice(0, 10).forEach(file => {
                                console.warn(`      - ${file}`);
                            });
                            if (extraInBackup.length > 10) {
                                console.warn(`      ... and ${extraInBackup.length - 10} more`);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`    ⚠️  Warning: Could not verify backup completeness: ${error.message}`);
                }
            } catch (error) {
                console.warn(`  ⚠️  Warning: Could not backup attachments: ${error.message}`);
                console.warn(`  Continuing with database backup only...`);
            }
        }
    } catch (error) {
        console.warn(`  ⚠️  Warning: Could not access storage container: ${error.message}`);
        console.warn(`  Continuing with database backup only...`);
    }

    // Calculate total backup size
    const rolesStats = fs.existsSync(rolesPath) ? fs.statSync(rolesPath) : { size: 0 };
    const schemaStats = fs.existsSync(schemaPath) ? fs.statSync(schemaPath) : { size: 0 };
    const dataStats = fs.existsSync(dataPath) ? fs.statSync(dataPath) : { size: 0 };
    const attachmentsStats = fs.existsSync(attachmentsBackupDir) ? { size: getDirSize(attachmentsBackupDir) } : { size: 0 };
    const totalSizeMB = ((rolesStats.size + schemaStats.size + dataStats.size + attachmentsStats.size) / (1024 * 1024)).toFixed(2);
    const totalSizeGB = ((rolesStats.size + schemaStats.size + dataStats.size + attachmentsStats.size) / (1024 * 1024 * 1024)).toFixed(2);
    
    console.log(`\n✓ Backup completed successfully!`);
    console.log(`  Roles: ${path.basename(rolesPath)} (${(rolesStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Schema: ${path.basename(schemaPath)} (${(schemaStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Data: ${path.basename(dataPath)} (${(dataStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    if (attachmentsStats.size > 0) {
        console.log(`  Attachments: ${path.basename(attachmentsBackupDir)} (${(attachmentsStats.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    }
    console.log(`  Total size: ${totalSizeGB} GB (${totalSizeMB} MB)`);
    console.log(`  Location: ${BACKUP_DIR}`);

    // Clean up old backups (older than RETENTION_DAYS)
    // Group backups by timestamp prefix and delete entire backup sets
    // Safety check: Don't delete backups that are larger than the current backup
    console.log(`\nCleaning up backups older than ${RETENTION_DAYS} days...`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    // Calculate current backup total size (database + attachments)
    const currentBackupSize = rolesStats.size + schemaStats.size + dataStats.size + attachmentsStats.size;
    
    const files = fs.readdirSync(BACKUP_DIR);
    const backupSets = new Map(); // Map of timestamp prefix -> backup info
    
    // Helper function to calculate backup set size
    const calculateBackupSetSize = (prefix) => {
        let totalSize = 0;
        const rolesFile = path.join(BACKUP_DIR, `${prefix}-roles.sql`);
        const schemaFile = path.join(BACKUP_DIR, `${prefix}-schema.sql`);
        const dataFile = path.join(BACKUP_DIR, `${prefix}-data.sql`);
        const attachmentsDir = path.join(BACKUP_DIR, `${prefix}-attachments`);
        
        if (fs.existsSync(rolesFile)) totalSize += fs.statSync(rolesFile).size;
        if (fs.existsSync(schemaFile)) totalSize += fs.statSync(schemaFile).size;
        if (fs.existsSync(dataFile)) totalSize += fs.statSync(dataFile).size;
        if (fs.existsSync(attachmentsDir)) {
            totalSize += getDirSize(attachmentsDir);
        }
        return totalSize;
    };
    
    // Group files by backup prefix (backup-TIMESTAMP-*)
    for (const file of files) {
        const match = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-(roles|schema|data)\.sql$/);
        if (match) {
            const prefix = match[1];
            if (!backupSets.has(prefix)) {
                backupSets.set(prefix, {
                    files: [],
                    hasAttachments: fs.existsSync(path.join(BACKUP_DIR, `${prefix}-attachments`))
                });
            }
            backupSets.get(prefix).files.push(file);
        }
    }
    
    // Also check for attachment directories
    for (const file of files) {
        const match = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-attachments$/);
        if (match) {
            const prefix = match[1];
            if (!backupSets.has(prefix)) {
                backupSets.set(prefix, { files: [], hasAttachments: true });
            } else {
                backupSets.get(prefix).hasAttachments = true;
            }
        }
    }
    
    let deletedSets = 0;
    let deletedFiles = 0;
    let skippedSets = 0;
    
    // Delete backup sets older than retention period
    for (const [prefix, backupInfo] of backupSets.entries()) {
        // Check the oldest file in the set to determine age
        let oldestDate = null;
        for (const file of backupInfo.files) {
            const filePath = path.join(BACKUP_DIR, file);
            if (fs.existsSync(filePath)) {
                const fileStats = fs.statSync(filePath);
                if (!oldestDate || fileStats.mtime < oldestDate) {
                    oldestDate = fileStats.mtime;
                }
            }
        }
        
        // Check attachments directory if it exists
        const attachmentsDir = path.join(BACKUP_DIR, `${prefix}-attachments`);
        if (fs.existsSync(attachmentsDir)) {
            const dirStats = fs.statSync(attachmentsDir);
            if (!oldestDate || dirStats.mtime < oldestDate) {
                oldestDate = dirStats.mtime;
            }
        }
        
        if (oldestDate && oldestDate < cutoffDate) {
            // Safety check: Don't delete if this backup is larger than current backup
            const backupSetSize = calculateBackupSetSize(prefix);
            if (backupSetSize > currentBackupSize) {
                console.log(`  ⚠️  Skipping deletion of ${prefix} (${(backupSetSize / (1024 * 1024 * 1024)).toFixed(2)} GB) - larger than current backup (${(currentBackupSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
                skippedSets++;
                continue;
            }
            
            // Delete all files in this backup set
            for (const file of backupInfo.files) {
                const filePath = path.join(BACKUP_DIR, file);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        deletedFiles++;
                    } catch (error) {
                        console.warn(`  Warning: Failed to delete old backup file: ${file}`);
                        console.warn(`  ${error.message}`);
                    }
                }
            }
            
            // Delete attachments directory if it exists
            if (fs.existsSync(attachmentsDir)) {
                try {
                    fs.rmSync(attachmentsDir, { recursive: true, force: true });
                    deletedFiles++;
                } catch (error) {
                    console.warn(`  Warning: Failed to delete old attachments directory: ${path.basename(attachmentsDir)}`);
                    console.warn(`  ${error.message}`);
                }
            }
            
            deletedSets++;
        }
    }
    
    if (deletedSets > 0) {
        console.log(`✓ Cleaned up ${deletedSets} old backup set(s) (${deletedFiles} files/directories)`);
    } else {
        console.log(`✓ No old backups to clean up`);
    }
    
    if (skippedSets > 0) {
        console.log(`⚠️  Skipped ${skippedSets} backup set(s) that are larger than current backup (safety check)`);
    }
    
    console.log(`\nBackup process completed successfully!`);
    
} catch (error) {
    console.error('\n✗ Backup failed!');
    console.error(error.message);
    
    // Clean up partial backup files if they exist
    const partialFiles = [rolesPath, schemaPath, dataPath];
    for (const filePath of partialFiles) {
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up partial backup file: ${path.basename(filePath)}`);
            } catch (cleanupError) {
                console.warn(`Warning: Failed to clean up partial backup file: ${path.basename(filePath)}`);
            }
        }
    }
    
    // Clean up partial attachments backup directory if it exists
    if (fs.existsSync(attachmentsBackupDir)) {
        try {
            fs.rmSync(attachmentsBackupDir, { recursive: true, force: true });
            console.log(`Cleaned up partial attachments backup directory: ${path.basename(attachmentsBackupDir)}`);
        } catch (cleanupError) {
            console.warn(`Warning: Failed to clean up partial attachments backup directory: ${path.basename(attachmentsBackupDir)}`);
        }
    }
    
    process.exit(1);
}
