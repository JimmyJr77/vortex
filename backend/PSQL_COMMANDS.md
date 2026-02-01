# PostgreSQL Commands Guide

After running:
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics
```

## Essential Commands

### 1. List All Tables
```sql
\dt
```
Shows all tables in the database.

### 2. View Table Structure
```sql
\d registrations
\d table_name
```
Shows columns, types, constraints, and indexes for a table.

### 3. View All Data in Registrations Table
```sql
SELECT * FROM registrations;
```

### 4. View All Data with Better Formatting
```sql
SELECT * FROM registrations ORDER BY created_at DESC;
```

### 5. View Specific Columns
```sql
SELECT id, first_name, last_name, email, phone, created_at 
FROM registrations 
ORDER BY created_at DESC;
```

### 6. Count Records
```sql
SELECT COUNT(*) FROM registrations;
```

### 7. View All Tables and Row Counts
```sql
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.tables t2 
     WHERE t2.table_schema = t1.schemaname 
     AND t2.table_name = t1.tablename) as row_count
FROM pg_tables t1
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 8. Get Row Count for Each Table
```sql
SELECT 
    'registrations' as table_name, COUNT(*) as row_count FROM registrations
UNION ALL
SELECT 'newsletter_subscribers', COUNT(*) FROM newsletter_subscribers
UNION ALL
SELECT 'member', COUNT(*) FROM member
UNION ALL
SELECT 'app_user', COUNT(*) FROM app_user
UNION ALL
SELECT 'family', COUNT(*) FROM family
UNION ALL
SELECT 'athlete', COUNT(*) FROM athlete
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'program', COUNT(*) FROM program;
```

## Explore All Tables

### View All Newsletter Subscribers
```sql
SELECT * FROM newsletter_subscribers ORDER BY created_at DESC;
```

### View All Members
```sql
SELECT id, first_name, last_name, email, phone, created_at 
FROM member 
ORDER BY created_at DESC;
```

### View All App Users
```sql
SELECT id, email, username, role, created_at 
FROM app_user 
ORDER BY created_at DESC;
```

### View All Families
```sql
SELECT id, family_name, family_username, created_at 
FROM family 
ORDER BY created_at DESC;
```

### View All Athletes
```sql
SELECT id, first_name, last_name, email, date_of_birth, created_at 
FROM athlete 
ORDER BY created_at DESC;
```

### View All Events
```sql
SELECT id, event_name, start_date, end_date, type, created_at 
FROM events 
ORDER BY start_date DESC;
```

### View All Programs
```sql
SELECT id, display_name, skill_level, is_active, created_at 
FROM program 
ORDER BY created_at DESC;
```

## Useful psql Meta-Commands

### List All Databases
```sql
\l
```

### List All Tables (detailed)
```sql
\dt+
```

### Describe All Tables
```sql
\d+
```

### Show All Schemas
```sql
\dn
```

### Show All Functions
```sql
\df
```

### Show All Indexes
```sql
\di
```

### Show Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Exit psql
```sql
\q
```

## Quick Exploration Script

Run this to see everything at once:

```sql
-- Show all tables
\dt

-- Count records in each main table
SELECT 'registrations' as table_name, COUNT(*) as count FROM registrations
UNION ALL SELECT 'newsletter_subscribers', COUNT(*) FROM newsletter_subscribers
UNION ALL SELECT 'member', COUNT(*) FROM member
UNION ALL SELECT 'app_user', COUNT(*) FROM app_user
UNION ALL SELECT 'family', COUNT(*) FROM family
UNION ALL SELECT 'athlete', COUNT(*) FROM athlete
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'program', COUNT(*) FROM program
ORDER BY count DESC;

-- View all registrations
SELECT * FROM registrations ORDER BY created_at DESC;
```

## Search Commands

### Search by Email
```sql
SELECT * FROM registrations WHERE email LIKE '%search_term%';
```

### Search by Name
```sql
SELECT * FROM registrations 
WHERE first_name ILIKE '%search_term%' 
   OR last_name ILIKE '%search_term%';
```

### Search by Date Range
```sql
SELECT * FROM registrations 
WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY created_at DESC;
```

### Search Recent (Last 7 Days)
```sql
SELECT * FROM registrations 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Formatting Output

### Enable Expanded Display (for wide tables)
```sql
\x
```
Run again to toggle off.

### Set Column Width
```sql
\pset format wrapped
\pset columns 200
```

### Show Query Execution Time
```sql
\timing
```

