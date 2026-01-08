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

// Generate backup filenames with timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPrefix = `backup-${timestamp}`;
const rolesPath = path.join(BACKUP_DIR, `${backupPrefix}-roles.sql`);
const schemaPath = path.join(BACKUP_DIR, `${backupPrefix}-schema.sql`);
const dataPath = path.join(BACKUP_DIR, `${backupPrefix}-data.sql`);

console.log(`Starting database backup...`);
console.log(`Backup files will be saved to: ${BACKUP_DIR}`);
console.log(`  - Roles: ${path.basename(rolesPath)}`);
console.log(`  - Schema: ${path.basename(schemaPath)}`);
console.log(`  - Data: ${path.basename(dataPath)}`);

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

    // Calculate total backup size
    const rolesStats = fs.existsSync(rolesPath) ? fs.statSync(rolesPath) : { size: 0 };
    const schemaStats = fs.existsSync(schemaPath) ? fs.statSync(schemaPath) : { size: 0 };
    const dataStats = fs.existsSync(dataPath) ? fs.statSync(dataPath) : { size: 0 };
    const totalSizeMB = ((rolesStats.size + schemaStats.size + dataStats.size) / (1024 * 1024)).toFixed(2);
    
    console.log(`✓ Backup completed successfully!`);
    console.log(`  Roles: ${path.basename(rolesPath)} (${(rolesStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Schema: ${path.basename(schemaPath)} (${(schemaStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Data: ${path.basename(dataPath)} (${(dataStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Total size: ${totalSizeMB} MB`);
    console.log(`  Location: ${BACKUP_DIR}`);

    // Clean up old backups (older than RETENTION_DAYS)
    // Group backups by timestamp prefix and delete entire backup sets
    console.log(`\nCleaning up backups older than ${RETENTION_DAYS} days...`);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    const files = fs.readdirSync(BACKUP_DIR);
    const backupSets = new Map(); // Map of timestamp prefix -> file paths
    
    // Group files by backup prefix (backup-TIMESTAMP-*)
    for (const file of files) {
        const match = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-(roles|schema|data)\.sql$/);
        if (match) {
            const prefix = match[1];
            if (!backupSets.has(prefix)) {
                backupSets.set(prefix, []);
            }
            backupSets.get(prefix).push(file);
        }
    }
    
    let deletedSets = 0;
    let deletedFiles = 0;
    
    // Delete backup sets older than retention period
    for (const [prefix, fileList] of backupSets.entries()) {
        // Check the oldest file in the set to determine age
        let oldestDate = null;
        for (const file of fileList) {
            const filePath = path.join(BACKUP_DIR, file);
            const fileStats = fs.statSync(filePath);
            if (!oldestDate || fileStats.mtime < oldestDate) {
                oldestDate = fileStats.mtime;
            }
        }
        
        if (oldestDate < cutoffDate) {
            // Delete all files in this backup set
            for (const file of fileList) {
                const filePath = path.join(BACKUP_DIR, file);
                try {
                    fs.unlinkSync(filePath);
                    deletedFiles++;
                } catch (error) {
                    console.warn(`  Warning: Failed to delete old backup file: ${file}`);
                    console.warn(`  ${error.message}`);
                }
            }
            deletedSets++;
        }
    }
    
    if (deletedSets > 0) {
        console.log(`✓ Cleaned up ${deletedSets} old backup set(s) (${deletedFiles} files)`);
    } else {
        console.log(`✓ No old backups to clean up`);
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
    
    process.exit(1);
}

