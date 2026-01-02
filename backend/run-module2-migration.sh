#!/bin/bash
# Script to run Module 2 migrations on production
# This can be run via Render Shell or locally

echo "🔄 Running Module 2 migrations..."

cd backend

echo "📄 Running migration: 003_module_2_families_athletes.sql"
node run-migration.js 003_module_2_families_athletes.sql

echo "📄 Running migration: 004_add_user_id_to_athlete.sql"
node run-migration.js 004_add_user_id_to_athlete.sql

echo "✅ Module 2 migrations completed!"

