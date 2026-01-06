# Database Backups

This document explains how to configure and use the database backup and restore functionality for Atomic CRM.

## Overview

The backup system creates SQL dumps of your local Supabase database following the [official Supabase backup and restore documentation](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Each backup consists of three separate files (roles, schema, and data) stored in a configurable location. Backups are automatically cleaned up after 7 days to manage disk space.

**Important**: This backup system only backs up the PostgreSQL database. Storage bucket attachments are NOT included in backups.

## Configuration

### Setting the Backup Directory

Set the `BACKUP_DIR` environment variable inline when running backup commands. This keeps the configuration explicit and project-specific.

**Requirements**:
- Must be an absolute path
- Set it inline for each command
- Directory will be created automatically if it doesn't exist
- Must be writable by the user running the backup

**Example**:
```bash
BACKUP_DIR=/Users/kelly/atomic-crm-backups make backup-database
```

## Manual Backup

To create a backup manually, set `BACKUP_DIR` inline:

```bash
BACKUP_DIR=/path/to/backups make backup-database
```

**Example**:
```bash
BACKUP_DIR=/Users/kelly/atomic-crm-backups make backup-database
```

Each backup creates three files with a timestamp prefix: `backup-YYYY-MM-DD-HHMMSS-{roles,schema,data}.sql`

**Example output**:
```
Starting database backup...
Backup files will be saved to: /path/to/backups
  - Roles: backup-2024-01-15-143022-roles.sql
  - Schema: backup-2024-01-15-143022-schema.sql
  - Data: backup-2024-01-15-143022-data.sql
Dumping database roles...
Dumping database schema...
Dumping database data...
✓ Backup completed successfully!
  Roles: backup-2024-01-15-143022-roles.sql (0.01 MB)
  Schema: backup-2024-01-15-143022-schema.sql (0.15 MB)
  Data: backup-2024-01-15-143022-data.sql (2.29 MB)
  Total size: 2.45 MB
  Location: /path/to/backups
```

## Automatic Daily Backups

### macOS / Linux (cron)

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add a line to run the backup daily at 2 AM:
   ```bash
   0 2 * * * cd /Users/kelly/atomic-crm && BACKUP_DIR=/path/to/backups make backup-database >> /path/to/backups/backup.log 2>&1
   ```

   Replace:
   - `/Users/kelly/atomic-crm` with your project directory
   - `/path/to/backups` with your backup directory
   - Optionally add `>> /path/to/backups/backup.log 2>&1` to log output

3. Save and exit. The cron job will run automatically.

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create a new task
3. Set the trigger to "Daily" at your desired time
4. Set the action to run a program:
   - Program: `make` (or full path to make.exe)
   - Arguments: `backup-database`
   - Start in: Your project directory (e.g., `C:\Users\kelly\atomic-crm`)
5. Add an environment variable:
   - Variable: `BACKUP_DIR`
   - Value: Your backup directory path (e.g., `C:\Users\kelly\atomic-crm-backups`)

## Listing Backups

To see all available backups, set `BACKUP_DIR` inline:

```bash
BACKUP_DIR=/path/to/backups make list-backups
```

**Example**:
```bash
BACKUP_DIR=/Users/kelly/atomic-crm-backups make list-backups
```

**Example output**:
```
Available backups in /path/to/backups:

backup-2024-01-15-143022
backup-2024-01-14-143015
backup-2024-01-13-143008
```

Each backup consists of three files (roles, schema, and data) that are grouped together by their timestamp prefix.

## Restoring from Backup

**⚠️ WARNING**: Restoring will completely replace your current database. All existing data will be lost!

To restore from a backup, provide the backup prefix (timestamp part):

```bash
make restore-database BACKUP_PREFIX=backup-2024-01-15-143022
```

Or provide the full path to the backup directory:

```bash
make restore-database BACKUP_PREFIX=/path/to/backups/backup-2024-01-15-143022
```

The restore process follows the [official Supabase restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):
1. Validates all three backup files exist (roles, schema, data)
2. Asks for confirmation (since it's destructive)
3. Restores in a single transaction:
   - First restores roles
   - Then restores schema
   - Finally restores data (with triggers disabled to prevent conflicts)
4. Uses `--single-transaction` and `ON_ERROR_STOP=1` for safety

**Example**:
```bash
$ make restore-database BACKUP_PREFIX=backup-2024-01-15-143022

Database Restore
================
Backup prefix: backup-2024-01-15-143022
Backup directory: /path/to/backups
  - Roles: backup-2024-01-15-143022-roles.sql (0.01 MB)
  - Schema: backup-2024-01-15-143022-schema.sql (0.15 MB)
  - Data: backup-2024-01-15-143022-data.sql (2.29 MB)
Total size: 2.45 MB
Date: 1/15/2024, 2:30:22 PM

⚠️  WARNING: This operation will:
   1. Replace the entire database with the backup
   2. All current data will be lost
   3. This cannot be undone!

? Are you sure you want to proceed with the restore? (y/N)
```

## Backup Retention

Backups older than 7 days are automatically deleted when a new backup is created. This helps manage disk space while keeping recent backups available.

To change the retention period, edit `scripts/backup-database.mjs` and modify the `RETENTION_DAYS` constant.

## Troubleshooting

### "BACKUP_DIR environment variable is not set"

Make sure you set `BACKUP_DIR` inline when running the command:
```bash
BACKUP_DIR=/path/to/backups make backup-database
```

### "Supabase does not appear to be running"

Start Supabase before creating a backup:
```bash
make start-supabase
```

### "Backup directory is not writable"

Check that the backup directory exists and has write permissions:
```bash
ls -ld /path/to/backups
chmod u+w /path/to/backups  # If needed
```

### Restore fails

If a restore fails:
1. Check that Supabase is running
2. Verify all three backup files exist (roles, schema, data)
3. Check that the backup files are not corrupted
4. The restore uses a single transaction, so if it fails, the database will be rolled back to its previous state
5. If needed, try resetting the database manually: `make supabase-reset-database`
6. Then attempt the restore again

### "Backup files not found for prefix"

Make sure you're using the correct backup prefix. The prefix should match the timestamp part of the backup files (e.g., `backup-2024-01-15-143022`). All three files (roles, schema, data) must exist in the backup directory.

## Backup File Format

Backups are stored as three separate plain SQL files following the [official Supabase backup format](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):

1. **`backup-TIMESTAMP-roles.sql`**: Database roles and permissions
2. **`backup-TIMESTAMP-schema.sql`**: Database schema (tables, views, functions, triggers, etc.)
3. **`backup-TIMESTAMP-data.sql`**: All table data (using COPY statements for efficient bulk loading)

All files:
- Are plain text SQL files
- Can be read and edited with any text editor
- Are compatible with standard PostgreSQL tools
- Follow Supabase's recommended backup structure

## Best Practices

1. **Test your backups**: Periodically restore a backup to a test environment to ensure they work
2. **Store backups off-site**: Consider copying backups to cloud storage or another location
3. **Monitor disk space**: Ensure your backup directory has sufficient space
4. **Document your setup**: Keep track of where backups are stored and how to restore them
5. **Regular testing**: Test the restore process in a non-production environment

