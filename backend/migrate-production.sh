#!/bin/bash
# Script to run migration on Render production
# This can be run via Render Shell

echo "🔄 Running migration: add_categories_levels_tables.sql"
cd backend
node run-migration.js add_categories_levels_tables.sql





