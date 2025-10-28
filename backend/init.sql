-- Initialize Vortex Athletics Database
-- This file is automatically executed when PostgreSQL container starts

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- CREATE DATABASE IF NOT EXISTS vortex_athletics;

-- Connect to the database
\c vortex_athletics;

-- Create registrations table
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    athlete_age INTEGER CHECK (athlete_age >= 5 AND athlete_age <= 18),
    interests TEXT,
    message TEXT,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create newsletter subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- Insert some sample data for testing (optional)
-- INSERT INTO registrations (first_name, last_name, email, phone, athlete_age, interests, message) 
-- VALUES 
--     ('John', 'Doe', 'john.doe@example.com', '555-0123', 12, 'Gymnastics, Strength Training', 'Interested in competitive programs'),
--     ('Jane', 'Smith', 'jane.smith@example.com', '555-0456', 14, 'Flexibility, Balance', 'Looking for advanced training');

-- INSERT INTO newsletter_subscribers (email) 
-- VALUES 
--     ('newsletter@example.com'),
--     ('updates@example.com');

-- Grant permissions (if needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
