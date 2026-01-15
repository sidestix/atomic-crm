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

// Find all backup prefixes
for (const file of files) {
    const match = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-(roles|schema|data)\.sql$/);
    if (match) {
        backupSets.add(match[1]);
    }
    // Also check for attachment directories
    const attachmentMatch = file.match(/^(backup-\d{4}-\d{2}-\d{2}-\d{6})-attachments$/);
    if (attachmentMatch && fs.statSync(path.join(BACKUP_DIR, file)).isDirectory()) {
        backupSets.add(attachmentMatch[1]);
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
    const attachmentsPath = path.join(BACKUP_DIR, `${prefix}-attachments`);
    
    if (fs.existsSync(rolesPath) && fs.existsSync(schemaPath) && fs.existsSync(dataPath)) {
        const rolesStats = fs.statSync(rolesPath);
        const schemaStats = fs.statSync(schemaPath);
        const dataStats = fs.statSync(dataPath);
        const attachmentsSize = fs.existsSync(attachmentsPath) ? getDirSize(attachmentsPath) : 0;
        const totalSize = rolesStats.size + schemaStats.size + dataStats.size + attachmentsSize;
        const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const date = dataStats.mtime.toLocaleString();
        
        const hasAttachments = fs.existsSync(attachmentsPath);
        const attachmentsInfo = hasAttachments ? `, attachments: ${(attachmentsSize / (1024 * 1024 * 1024)).toFixed(2)} GB` : '';
        
        console.log(`${prefix} (${totalSizeGB} GB / ${totalSizeMB} MB${attachmentsInfo}, ${date})`);
    }
}

