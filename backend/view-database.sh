#!/bin/bash

# Script to view PostgreSQL database using Docker

echo "🔍 Connecting to PostgreSQL database..."
echo ""

# Check if Docker container is running
if ! docker ps | grep -q vortex_postgres; then
    echo "❌ PostgreSQL container is not running!"
    echo "   Start it with: docker-compose up -d postgres"
    exit 1
fi

echo "✅ PostgreSQL container is running"
echo ""
echo "📊 Available commands:"
echo ""
echo "1. View all registrations:"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c \"SELECT id, first_name, last_name, email, phone, created_at FROM registrations ORDER BY created_at DESC;\""
echo ""
echo "2. View registrations after a specific date:"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c \"SELECT id, first_name, last_name, email, phone, created_at FROM registrations WHERE created_at > '2024-12-31' ORDER BY created_at DESC;\""
echo ""
echo "3. Search for specific email or name:"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c \"SELECT * FROM registrations WHERE email LIKE '%bib%' OR first_name LIKE '%bib%' OR last_name LIKE '%bib%';\""
echo ""
echo "4. Open interactive psql shell:"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics"
echo ""
echo "5. Count total registrations:"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c \"SELECT COUNT(*) as total FROM registrations;\""
echo ""
echo "6. View recent registrations (last 10):"
echo "   docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c \"SELECT id, first_name, last_name, email, created_at FROM registrations ORDER BY created_at DESC LIMIT 10;\""
echo ""

# Ask if user wants to run a query
read -p "Would you like to view all registrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker exec -it vortex_postgres psql -U postgres -d vortex_athletics -c "SELECT id, first_name, last_name, email, phone, created_at, archived FROM registrations ORDER BY created_at DESC;"
fi

