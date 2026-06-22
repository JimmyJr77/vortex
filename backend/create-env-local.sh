#!/bin/bash
# Script to create .env.local with correct database credentials

cat > .env.local << 'EOF'
# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Public URL used to build links in emails
PUBLIC_APP_URL=http://localhost:5173

# Email / SMTP (Google Workspace App Password recommended).
# Leave SMTP_USER / SMTP_PASS blank locally to skip sending (calls no-op).
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Vortex Athletics <team@vortexathletics.com>"

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vortex_athletics
DB_USER=postgres
DB_PASSWORD=vortex2024

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EOF

echo "✅ Created .env.local file with database credentials"
echo ""
echo "Your database settings:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: vortex_athletics"
echo "  Username: postgres"
echo "  Password: vortex2024"
echo ""
echo "Now restart your server: npm start"

