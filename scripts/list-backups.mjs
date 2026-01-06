import fs from 'node:fs';
import path from 'node:path';

const BACKUP_DIR = process.env.BACKUP_DIR;

if (!BACKUP_DIR) {
    console.error('Error: BACKUP_DIR environment variable is not set.');
    console.error('');
    console.error('Set it inline when running the command:');
    console.error('  BACKUP_DIR=/path/to/backups make list-backups');
    console.error('');
    console.error('Example:');
    console.error('  BACKUP_DIR=/Users/kelly/atomic-crm-backups make list-backups');
    process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Error: Backup directory does not exist: ${BACKUP_DIR}`);
    process.exit(1);
}

console.log(`Available backups in ${BACKUP_DIR}:`);
console.log('');

const files = fs.readdirSync(BACKUP_DIR);
const backupSets = new Set();

// Find all backup prefixes
for (const file of files) {
    const match = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-(roles|schema|data)\.sql$/);
    if (match) {
        backupSets.add(match[1]);
    }
}

if (backupSets.size === 0) {
    console.log('No backups found.');
    process.exit(0);
}

// Display backups sorted by name (newest first)
const sortedPrefixes = Array.from(backupSets).sort().reverse();

for (const prefix of sortedPrefixes) {
    const rolesPath = path.join(BACKUP_DIR, `${prefix}-roles.sql`);
    const schemaPath = path.join(BACKUP_DIR, `${prefix}-schema.sql`);
    const dataPath = path.join(BACKUP_DIR, `${prefix}-data.sql`);
    
    if (fs.existsSync(rolesPath) && fs.existsSync(schemaPath) && fs.existsSync(dataPath)) {
        const rolesStats = fs.statSync(rolesPath);
        const schemaStats = fs.statSync(schemaPath);
        const dataStats = fs.statSync(dataPath);
        const totalSizeMB = ((rolesStats.size + schemaStats.size + dataStats.size) / (1024 * 1024)).toFixed(2);
        const date = dataStats.mtime.toLocaleString();
        
        console.log(`${prefix} (${totalSizeMB} MB, ${date})`);
    }
}

