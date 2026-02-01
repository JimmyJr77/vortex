# Install pgAdmin to View Your Database

pgAdmin is a web-based PostgreSQL administration tool. Here are several ways to install it:

## Option 1: Docker (Recommended - Matches Your Setup)

This runs pgAdmin in Docker, consistent with your existing setup.

### Step 1: Add pgAdmin to docker-compose.yml

I've created a separate file `docker-compose.pgadmin.yml` that you can merge, or add this to your existing `docker-compose.yml`:

```yaml
services:
  # ... your existing services ...
  
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: vortex_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@vortex.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
      PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: 'False'
    ports:
      - "5050:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    restart: unless-stopped
    depends_on:
      - postgres

volumes:
  # ... your existing volumes ...
  pgadmin_data:
```

### Step 2: Start pgAdmin

```bash
# If you added to existing docker-compose.yml:
docker-compose up -d pgadmin

# Or run the separate file:
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml up -d pgadmin
```

### Step 3: Access pgAdmin

1. Open browser: http://localhost:5050
2. Login:
   - Email: `admin@vortex.com`
   - Password: `admin`

### Step 4: Connect to Your Database

1. Right-click "Servers" → "Register" → "Server"
2. General tab:
   - Name: `Vortex Local` (or any name)
3. Connection tab:
   - Host: `postgres` (Docker service name) or `localhost`
   - Port: `5432`
   - Database: `vortex_athletics`
   - Username: `postgres`
   - Password: `vortex2024`
   - Check "Save password"
4. Click "Save"

Now you can browse your database!

## Option 2: Install pgAdmin Desktop App (Mac)

### Using Homebrew (Recommended)

```bash
brew install --cask pgadmin4
```

Then open pgAdmin from Applications.

### Manual Download

1. Visit: https://www.pgadmin.org/download/pgadmin-4-macos/
2. Download the installer
3. Install and open pgAdmin

### Connect to Local Database

1. Right-click "Servers" → "Register" → "Server"
2. Connection tab:
   - Host: `localhost`
   - Port: `5432`
   - Database: `vortex_athletics`
   - Username: `postgres`
   - Password: `vortex2024`

## Option 3: Connect to Production Database

If you have the production DATABASE_URL, you can connect to it:

1. Parse your DATABASE_URL (format: `postgresql://user:password@host:port/database`)
2. In pgAdmin, register a new server:
   - Host: (from DATABASE_URL)
   - Port: (from DATABASE_URL, usually 5432)
   - Database: (from DATABASE_URL)
   - Username: (from DATABASE_URL)
   - Password: (from DATABASE_URL)

## Quick Start Commands

```bash
# Start pgAdmin in Docker
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml up -d pgadmin

# View logs
docker logs vortex_pgadmin

# Stop pgAdmin
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml stop pgadmin

# Remove pgAdmin (keeps data)
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml rm -f pgadmin
```

## Using pgAdmin

Once connected, you can:

1. **Browse Tables**: Expand your database → Schemas → public → Tables
2. **View Data**: Right-click table → "View/Edit Data" → "All Rows"
3. **Run Queries**: Tools → Query Tool (or click SQL icon)
4. **Export Data**: Right-click table → "Backup" or "Export/Import"

### Example: View All Registrations

1. Navigate to: `Servers` → `Vortex Local` → `Databases` → `vortex_athletics` → `Schemas` → `public` → `Tables` → `registrations`
2. Right-click `registrations` → "View/Edit Data" → "All Rows"
3. You'll see all your registrations in a spreadsheet-like view!

## Troubleshooting

### Can't connect to database in Docker pgAdmin

If using Docker pgAdmin, use `postgres` as the hostname (the Docker service name), not `localhost`.

### Connection refused

Make sure your PostgreSQL container is running:
```bash
docker ps | grep vortex_postgres
```

### Forgot pgAdmin password

Reset by removing the volume:
```bash
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml down -v
docker-compose -f docker-compose.yml -f docker-compose.pgadmin.yml up -d pgadmin
```

## Security Note

The default credentials (`admin@vortex.com` / `admin`) are for local development only. Change them for production use!

