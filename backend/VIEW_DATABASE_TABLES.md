# How to View Your Database Tables

This guide shows you different ways to explore your PostgreSQL database and see what tables you have.

## Your Database Info
- **Database Name**: `vortex_athletics`
- **Username**: `postgres`
- **Password**: `vortex2024` (from docker-compose.yml)
- **Host**: `localhost`
- **Port**: `5432`

## Summary of Your Tables (20 total)

### Member/User Related Tables:
- `member` - Unified member table (1 row)
- `app_user` - User accounts with roles (1 row)
- `members` - Legacy members table (0 rows)
- `athlete` - Athlete records (0 rows)
- `family` - Family groups (0 rows)
- `family_guardian` - Family-guardian relationships (0 rows)
- `member_children` - Legacy member children table (0 rows)
- `member_program` - Member program enrollments (0 rows)
- `parent_guardian_authority` - Legal authority relationships (0 rows)

### Other Tables:
- `admins` - Legacy admin table (1 row)
- `events` - Event calendar (9 rows)
- `program` - Programs offered (14 rows)
- `class` - Classes/sessions (0 rows)
- `facility` - Facility information (1 row)
- `registrations` - Registration inquiries (1 row)
- `program_categories` - Program categories (6 rows)
- `skill_levels` - Skill levels (12 rows)
- `emergency_contact` - Emergency contacts (0 rows)
- `event_edit_log` - Event edit history (0 rows)
- `newsletter_subscribers` - Newsletter subscriptions (0 rows)

---

## Method 1: Use Your Existing Script (Easiest!)

You already have a script that lists all tables. Run it with the correct credentials:

```bash
cd backend
DB_HOST=localhost DB_PORT=5432 DB_NAME=vortex_athletics DB_USER=postgres DB_PASSWORD=vortex2024 node list-all-tables.js
```

This will show you:
- All table names
- Row counts for each table
- Column names for member-related tables

---

## Method 2: Connect Using psql (Command Line)

`psql` is PostgreSQL's command-line tool. Here's how to use it:

### Install psql (if you don't have it)

**On macOS:**
```bash
brew install postgresql
```

### Connect to Your Database

Since you're using Docker, you can connect in two ways:

#### Option A: Connect from your Mac directly
```bash
psql -h localhost -p 5432 -U postgres -d vortex_athletics
```
When prompted, enter password: `vortex2024`

#### Option B: Connect from inside the Docker container (easiest!)
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics
```
This doesn't require a password since you're already inside the container.

### Useful SQL Commands in psql

Once connected, you can run these commands:

```sql
-- List all tables
\dt

-- List all tables with more details
\dt+

-- Describe a specific table structure
\d table_name
-- Example:
\d member

-- List all tables and their row counts
SELECT 
    table_name,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- View all table names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- View table with column details
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- View data from a specific table (first 10 rows)
SELECT * FROM member LIMIT 10;
SELECT * FROM events LIMIT 10;
SELECT * FROM program LIMIT 10;

-- Count rows in each table
SELECT 
    schemaname,
    tablename,
    n_tup_ins - n_tup_del AS approximate_rows
FROM pg_stat_user_tables
ORDER BY tablename;

-- Exit psql
\q
```

---

## Method 3: Use a GUI Tool (Easiest for Visual Learners!)

GUI tools make it much easier to explore databases visually. Here are popular options:

### Option A: pgAdmin (Official PostgreSQL Tool)

1. **Install pgAdmin:**
   ```bash
   brew install --cask pgadmin4
   ```

2. **Add Server:**
   - Open pgAdmin
   - Right-click "Servers" → "Create" → "Server"
   - **General tab:**
     - Name: `Vortex Athletics Local`
   - **Connection tab:**
     - Host: `localhost`
     - Port: `5432`
     - Database: `vortex_athletics`
     - Username: `postgres`
     - Password: `vortex2024`
   - Click "Save"

3. **Browse Tables:**
   - Expand: Servers → Vortex Athletics Local → Databases → vortex_athletics → Schemas → public → Tables
   - Click any table to see its structure and data

### Option B: DBeaver (Free, Cross-Platform)

1. **Install DBeaver:**
   ```bash
   brew install --cask dbeaver-community
   ```

2. **Create Connection:**
   - Click "New Database Connection" (plug icon)
   - Select "PostgreSQL"
   - **Main tab:**
     - Host: `localhost`
     - Port: `5432`
     - Database: `vortex_athletics`
     - Username: `postgres`
     - Password: `vortex2024`
   - Click "Test Connection" (you may need to download drivers)
   - Click "Finish"

3. **Explore:**
   - Expand the connection → Databases → vortex_athletics → Schemas → public → Tables
   - Double-click any table to view data

### Option C: TablePlus (macOS Favorite)

1. **Install TablePlus:**
   ```bash
   brew install --cask tableplus
   ```

2. **Create Connection:**
   - Click "Create a new connection"
   - Select "PostgreSQL"
   - Enter:
     - Name: `Vortex Athletics`
     - Host: `localhost`
     - Port: `5432`
     - User: `postgres`
     - Password: `vortex2024`
     - Database: `vortex_athletics`
   - Click "Test" then "Save"

3. **Browse:**
   - Click on your connection
   - Tables are listed on the left sidebar
   - Click any table to view its data

---

## Method 4: Quick SQL Queries (via Docker)

You can also run SQL commands directly from your terminal without opening psql:

```bash
# List all tables
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "\dt"

# View a specific table structure
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "\d member"

# View all table names
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# Count rows in each table
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT tablename, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as column_count FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# View data from a table
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT * FROM member;"
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT * FROM events LIMIT 5;"
docker exec -i vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT * FROM program;"
```

---

## Recommended Workflow

**For beginners:** Start with **Method 3** (GUI tool like pgAdmin or DBeaver) - it's the most visual and user-friendly.

**For quick checks:** Use **Method 1** (your script) or **Method 4** (Docker commands).

**For advanced exploration:** Use **Method 2** (psql) when you want full SQL control.

---

## Understanding Your Table Relationships

Your database follows a structured architecture:

1. **`facility`** - Main facility (Vortex Athletics)
2. **`app_user`** - User accounts with roles (OWNER_ADMIN, COACH, PARENT_GUARDIAN, ATHLETE_VIEWER)
3. **`member`** - Unified member table (combines users and athletes)
4. **`family`** - Family groups
5. **`program`** - Available programs
6. **`class`** - Classes/sessions within programs
7. **`events`** - Calendar events
8. **Supporting tables** - Various lookup and relationship tables

---

## Troubleshooting

**Can't connect?**
- Make sure Docker is running: `docker-compose ps`
- Check if the database is up: `docker-compose up -d postgres`

**Password issues?**
- Default password is `vortex2024` (from docker-compose.yml)
- If you changed it, check your `.env` file or docker-compose.yml

**Connection refused?**
- Make sure the postgres container is running
- Check port 5432 isn't being used by another service

---

## Need Help?

If you get stuck, you can always:
1. Check if Docker is running: `docker-compose ps`
2. View database logs: `docker-compose logs postgres`
3. Restart the database: `docker-compose restart postgres`


