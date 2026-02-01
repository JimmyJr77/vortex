# pgAdmin Connection Guide

## Step-by-Step: Connect to Your Local Database

### 1. Open pgAdmin
- Go to: http://localhost:5050
- Login:
  - Email: `admin@vortex.com`
  - Password: `admin`

### 2. Register a New Server

1. **Right-click** on "Servers" in the left sidebar
2. Select **"Register"** → **"Server..."**

### 3. Fill in the Connection Details

#### General Tab:
- **Name**: `Vortex Local` (or any name you like)

#### Connection Tab:
- **Host name/address**: `postgres` ⚠️ **Important: Use `postgres` not `localhost`**
  - This is the Docker service name, which pgAdmin can access from within Docker network
- **Port**: `5432`
- **Maintenance database**: `vortex_athletics`
- **Username**: `postgres`
- **Password**: `vortex2024`
- ✅ **Check "Save password"** (so you don't have to enter it every time)

#### Advanced Tab (Optional):
- You can leave this empty

#### SSL Tab (Optional):
- You can leave this empty for local development

### 4. Save the Connection

Click **"Save"** at the bottom

### 5. View Your Tables

Once connected, expand the tree in the left sidebar:

```
Servers
  └── Vortex Local
      └── Databases
          └── vortex_athletics
              └── Schemas
                  └── public
                      └── Tables
                          ├── registrations
                          ├── newsletter_subscribers
                          ├── member
                          ├── app_user
                          ├── family
                          ├── athlete
                          ├── events
                          ├── program
                          └── ... (all your tables)
```

### 6. View Data in a Table

**Method 1: View All Rows**
1. Right-click on a table (e.g., `registrations`)
2. Select **"View/Edit Data"** → **"All Rows"**
3. You'll see all data in a spreadsheet-like view

**Method 2: Query Tool**
1. Right-click on a table
2. Select **"Query Tool"** (or click the SQL icon in toolbar)
3. Type your SQL query:
   ```sql
   SELECT * FROM registrations ORDER BY created_at DESC;
   ```
4. Click the "Execute" button (▶️) or press F5

## View All Tables at Once

1. Expand: `Servers` → `Vortex Local` → `Databases` → `vortex_athletics` → `Schemas` → `public` → `Tables`
2. You'll see a list of all tables in the right panel
3. Double-click any table to see its structure
4. Right-click any table to view data, edit, or query

## Common Tasks

### View Registrations Table
```
Right-click: registrations → View/Edit Data → All Rows
```

### Run a Custom Query
1. Click the **SQL icon** in the toolbar (or Tools → Query Tool)
2. Type your query:
   ```sql
   SELECT * FROM registrations 
   WHERE created_at > '2025-12-31' 
   ORDER BY created_at DESC;
   ```
3. Press **F5** or click **Execute** (▶️)

### See Table Structure
- Double-click any table to see columns, data types, constraints

### Export Data
- Right-click table → **"Backup"** or **"Export/Import"**

## Troubleshooting

### "Could not connect to server"
- Make sure your PostgreSQL container is running:
  ```bash
  docker ps | grep vortex_postgres
  ```
- If not running, start it:
  ```bash
  docker-compose up -d postgres
  ```

### "Connection refused" or "Host not found"
- Make sure you're using `postgres` as the hostname (not `localhost`)
- This works because pgAdmin and PostgreSQL are in the same Docker network

### Can't see tables
- Make sure you're expanding: `Databases` → `vortex_athletics` → `Schemas` → `public` → `Tables`
- Refresh by right-clicking and selecting "Refresh"

## Connect to Production Database (Optional)

If you want to connect to your production database:

1. Get your production DATABASE_URL from Render dashboard
2. Parse it (format: `postgresql://user:password@host:port/database`)
3. In pgAdmin, register a new server:
   - **Name**: `Vortex Production`
   - **Host**: (from DATABASE_URL)
   - **Port**: (from DATABASE_URL, usually 5432)
   - **Database**: (from DATABASE_URL)
   - **Username**: (from DATABASE_URL)
   - **Password**: (from DATABASE_URL)
   - **SSL Mode**: `Require` (for production)

## Quick Reference

| Setting | Value |
|---------|-------|
| Host | `postgres` |
| Port | `5432` |
| Database | `vortex_athletics` |
| Username | `postgres` |
| Password | `vortex2024` |

## Visual Guide

```
pgAdmin Interface:
┌─────────────────────────────────────┐
│  Left Sidebar                       │
│  ┌───────────────────────────────┐  │
│  │ Servers                       │  │
│  │  └── Vortex Local             │  │
│  │      └── Databases            │  │
│  │          └── vortex_athletics │  │
│  │              └── Schemas      │  │
│  │                  └── public   │  │
│  │                      └── Tables│  │
│  └───────────────────────────────┘  │
│                                      │
│  Right Panel (when table selected)   │
│  ┌───────────────────────────────┐  │
│  │ Table Data / Query Results     │  │
│  │ (Spreadsheet view)             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

