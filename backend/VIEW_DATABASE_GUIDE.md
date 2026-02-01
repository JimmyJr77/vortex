# How to View Your Database

Your database is **PostgreSQL** (not MongoDB) running in Docker.

## Quick Start

### 1. Start Docker Database

```bash
# From project root
docker-compose up -d postgres
```

This starts the PostgreSQL container in the background.

### 2. View Database - Quick Commands

#### View all registrations:
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT id, first_name, last_name, email, phone, created_at FROM registrations ORDER BY created_at DESC;"
```

#### View registrations after Dec 31, 2024:
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT id, first_name, last_name, email, phone, created_at FROM registrations WHERE created_at > '2024-12-31' ORDER BY created_at DESC;"
```

#### Search for specific email/name (e.g., "bib"):
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT * FROM registrations WHERE LOWER(email) LIKE '%bib%' OR LOWER(first_name) LIKE '%bib%' OR LOWER(last_name) LIKE '%bib%';"
```

#### Count total registrations:
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT COUNT(*) as total FROM registrations;"
```

### 3. Interactive SQL Shell (Best for exploring)

Open an interactive PostgreSQL shell:
```bash
docker exec -it vortex_postgres psql -U postgres -d vortex_athletics
```

Once inside, you can run SQL queries:
```sql
-- List all tables
\dt

-- View registrations table structure
\d registrations

-- View all registrations
SELECT * FROM registrations ORDER BY created_at DESC;

-- View registrations after a date
SELECT * FROM registrations WHERE created_at > '2024-12-31' ORDER BY created_at DESC;

-- Search for specific text
SELECT * FROM registrations WHERE email LIKE '%bib%';

-- Exit
\q
```

### 4. Use the Helper Script

Run the helper script:
```bash
cd backend
./view-database.sh
```

## Database Connection Info

- **Host**: localhost (when using Docker)
- **Port**: 5432
- **Database**: vortex_athletics
- **Username**: postgres
- **Password**: vortex2024

## Using a GUI Tool (Optional)

### Option 1: pgAdmin (Web-based)
```bash
# Add to docker-compose.yml or run separately
docker run -p 5050:80 -e PGADMIN_DEFAULT_EMAIL=admin@admin.com -e PGADMIN_DEFAULT_PASSWORD=admin dpage/pgadmin4
```

### Option 2: TablePlus (Mac App)
- Download from: https://tableplus.com/
- Connect using:
  - Host: localhost
  - Port: 5432
  - Database: vortex_athletics
  - Username: postgres
  - Password: vortex2024

### Option 3: DBeaver (Free, Cross-platform)
- Download from: https://dbeaver.io/
- Create new PostgreSQL connection with above credentials

## Common Queries

### Check if archived column exists:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'registrations' AND column_name = 'archived';
```

### View registrations with all details:
```sql
SELECT 
  id,
  first_name,
  last_name,
  email,
  phone,
  athlete_age,
  interests,
  interests_array,
  class_types,
  child_ages,
  message,
  created_at,
  archived
FROM registrations 
ORDER BY created_at DESC;
```

### Find recent submissions (last 7 days):
```sql
SELECT * FROM registrations 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

