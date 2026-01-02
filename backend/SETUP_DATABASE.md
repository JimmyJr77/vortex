# Database Setup Guide

## Quick Setup

Your database is running in Docker! Here's what you need to know:

### Your Database Information (from docker-compose.yml):
- **Host**: `localhost` (since Docker exposes port 5432)
- **Port**: `5432`
- **Database Name**: `vortex_athletics`
- **Username**: `postgres`
- **Password**: `vortex2024`

## Step 1: Create/Update `.env.local` file

In the `backend` folder, create or update a file called `.env.local` with these exact lines:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vortex_athletics
DB_USER=postgres
DB_PASSWORD=vortex2024
```

## Step 2: Verify Your Database is Running

Run this command to check:
```bash
docker ps | grep postgres
```

You should see `vortex_postgres` running.

## Step 3: Test the Connection

You can test if your credentials work by running:
```bash
psql -h localhost -U postgres -d vortex_athletics
```

When prompted, enter password: `vortex2024`

If it connects, type `\q` to quit.

## Step 4: Restart Your Server

After updating `.env.local`, restart your backend server:
```bash
cd backend
npm start
```

You should see:
- `✅ Connected to PostgreSQL database`
- `✅ Module 0 (Identity, Roles, Facility) initialized`
- `✅ Database tables initialized successfully`

## Troubleshooting

### If you get "password authentication failed":
1. Make sure your `.env.local` file has the correct password: `vortex2024`
2. Make sure there are no extra spaces or quotes around the values
3. Restart your server after making changes

### If you get "connection refused":
1. Make sure Docker is running: `docker ps`
2. Make sure the PostgreSQL container is running: `docker ps | grep postgres`
3. If not running, start it: `docker-compose up -d postgres`

### If the database doesn't exist:
The database should be created automatically by Docker, but if needed:
```bash
docker exec -it vortex_postgres psql -U postgres -c "CREATE DATABASE vortex_athletics;"
```

