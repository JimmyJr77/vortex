import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pkg from 'pg'
import Joi from 'joi'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pkg

// Load environment variables - try .env.local first, then .env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to load .env.local first (for local development)
const envLocalPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📝 Loaded .env.local')
} else {
  // Fall back to .env
  dotenv.config()
  console.log('📝 Loaded .env')
}

const JWT_SECRET = process.env.JWT_SECRET || 'vortex-secret-key-change-in-production'

const app = express()
const PORT = process.env.PORT || 3001

// CORS configuration - must be before helmet
const allowedOrigins = [
  'http://localhost:5173',
  'https://vortexathletics.com',
  'https://www.vortexathletics.com',
  // Allow Vercel deployments (pattern matching)
  /^https:\/\/.*\.vercel\.app$/,
  // Allow from environment variable if set
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
].filter(Boolean) // Remove any undefined values

// Helper function to check if origin is allowed
function isOriginAllowed(origin) {
  // Allow requests with no origin (same-origin requests, server-to-server, etc.)
  if (!origin) return true
  
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '')
  const isAllowed = allowedOrigins.some(allowed => {
    // Handle regex patterns (for Vercel deployments)
    if (allowed instanceof RegExp) {
      return allowed.test(normalizedOrigin)
    }
    // Handle string origins
    const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, '')
    return normalizedOrigin === normalizedAllowed
  })
  
  // Log in production for debugging CORS issues
  if (!isAllowed && process.env.NODE_ENV === 'production') {
    console.log(`[CORS] Blocked origin: ${origin} (normalized: ${normalizedOrigin})`)
    console.log(`[CORS] Allowed origins:`, allowedOrigins.filter(o => typeof o === 'string'))
  }
  
  return isAllowed
}

// Helper function to set CORS headers on response
function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}

app.use(cors({
  origin: function (origin, callback) {
    // Only log blocked origins or in development to reduce log noise
    if (!origin) {
      // Same-origin request - allow silently
      return callback(null, true)
    }
    
    if (isOriginAllowed(origin)) {
      // Only log in development or when debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('[CORS] Allowed request from:', origin)
      }
      callback(null, true)
    } else {
      // Always log blocked origins
      console.warn(`[CORS] Blocked origin: ${origin}`)
      console.warn('[CORS] Allowed origins:', allowedOrigins.filter(o => typeof o === 'string'))
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}))

// Middleware - helmet after CORS to avoid interfering with CORS headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}))

app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
app.use('/api/', limiter)

// PostgreSQL Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err)
  process.exit(-1)
})

// Initialize database tables
export const initDatabase = async () => {
  try {
    // Registrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        athlete_age INTEGER CHECK (athlete_age >= 5 AND athlete_age <= 18),
        interests TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Newsletter subscribers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Legacy members and member_children tables removed
    // Members are now managed through app_user, family, and athlete tables

    // Events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(255) NOT NULL,
        short_description TEXT NOT NULL,
        long_description TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        type VARCHAR(50) DEFAULT 'event' CHECK (type IN ('camp', 'class', 'event', 'watch-party')),
        address TEXT,
        dates_and_times JSONB DEFAULT '[]'::jsonb,
        key_details JSONB DEFAULT '[]'::jsonb,
        archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Add archived column if it doesn't exist (for existing databases)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE
    `)
    
    // Add tag columns if they don't exist (for existing databases)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_type VARCHAR(50) DEFAULT 'all_classes_and_parents'
    `)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_class_ids INTEGER[] DEFAULT NULL
    `)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_category_ids INTEGER[] DEFAULT NULL
    `)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_all_parents BOOLEAN DEFAULT FALSE
    `)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_boosters BOOLEAN DEFAULT FALSE
    `)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS tag_volunteers BOOLEAN DEFAULT FALSE
    `)
    
    // Add images column if it doesn't exist (for storing base64 image data)
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb
    `)
    
    // Create index for archived column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived)
    `)

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_members_email ON members(email)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_members_status ON members(account_status)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_member_children_member_id ON member_children(member_id)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date)
    `)

    // Event edit log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_edit_log (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        admin_email VARCHAR(255) NOT NULL,
        admin_name VARCHAR(255),
        changes JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_event_edit_log_event_id ON event_edit_log(event_id)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_event_edit_log_created_at ON event_edit_log(created_at DESC)
    `)

    // Admins table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_master BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)
    `)

    // Create master admin if it doesn't exist
    const masterAdminCheck = await pool.query('SELECT id FROM admins WHERE is_master = TRUE LIMIT 1')
    if (masterAdminCheck.rows.length === 0) {
      const masterPasswordHash = await bcrypt.hash('T3@Mvortex25!', 10)
      await pool.query(`
        INSERT INTO admins (first_name, last_name, email, phone, username, password_hash, is_master)
        VALUES ('Admin', 'User', 'admin@vortexathletics.com', NULL, 'admin', $1, TRUE)
        ON CONFLICT (username) DO NOTHING
      `, [masterPasswordHash])
      console.log('✅ Master admin created')
    }

    // ============================================================
    // MODULE 0: Identity, Roles, Facility Settings
    // ============================================================
    
    // Create user_role enum if it doesn't exist
    const typeExists = await pool.query(`
      SELECT 1 FROM pg_type WHERE typname = 'user_role'
    `)
    if (typeExists.rows.length === 0) {
      await pool.query(`
        CREATE TYPE user_role AS ENUM ('OWNER_ADMIN', 'COACH', 'PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
      `)
    } else {
      // Add ATHLETE to enum if it doesn't exist
      const athleteExists = await pool.query(`
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ATHLETE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
      `)
      if (athleteExists.rows.length === 0) {
        await pool.query(`
          ALTER TYPE user_role ADD VALUE 'ATHLETE'
        `)
      }
    }

    // Create facility table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility (
        id                  BIGSERIAL PRIMARY KEY,
        name                TEXT NOT NULL,
        timezone            TEXT NOT NULL DEFAULT 'America/New_York',
        logo_url            TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_facility_id ON facility(id)`)

    // Seed default facility if none exists
    await pool.query(`
      INSERT INTO facility (name, timezone)
      SELECT 'Vortex Athletics', 'America/New_York'
      WHERE NOT EXISTS (SELECT 1 FROM facility)
    `)

    // Create app_user table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_user (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        role                user_role NOT NULL,
        email               TEXT NOT NULL,
        phone               TEXT,
        full_name           TEXT NOT NULL,
        password_hash       TEXT,
        address             TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (facility_id, email)
      )
    `)
    // Ensure address column exists (for existing databases)
    await pool.query('ALTER TABLE app_user ADD COLUMN IF NOT EXISTS address TEXT')
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_facility_role ON app_user(facility_id, role)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_active ON app_user(is_active)`)

    // Create user_role junction table for multiple roles per user
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_role (
        id                  BIGSERIAL PRIMARY KEY,
        user_id             BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        role                user_role NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, role)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_role_user_id ON user_role(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_role_role ON user_role(role)`)
    
    // Migrate existing single roles to user_role table
    await pool.query(`
      INSERT INTO user_role (user_id, role, created_at)
      SELECT id, role, created_at
      FROM app_user
      WHERE NOT EXISTS (
        SELECT 1 FROM user_role ur WHERE ur.user_id = app_user.id AND ur.role = app_user.role
      )
    `)

    // Migrate existing admins to app_user as OWNER_ADMIN
    await pool.query(`
      INSERT INTO app_user (
        facility_id,
        role,
        email,
        phone,
        full_name,
        password_hash,
        is_active,
        created_at,
        updated_at
      )
      SELECT 
        (SELECT id FROM facility LIMIT 1) as facility_id,
        'OWNER_ADMIN'::user_role as role,
        email,
        phone,
        COALESCE(first_name || ' ' || last_name, 'Admin User') as full_name,
        password_hash,
        TRUE as is_active,
        created_at,
        updated_at
      FROM admins
      WHERE NOT EXISTS (
        SELECT 1 FROM app_user 
        WHERE app_user.email = admins.email
      )
    `)

    // Legacy members table migration removed - members table is deprecated
    // Members are now managed through app_user, family, and athlete tables

    console.log('✅ Module 0 (Identity, Roles, Facility) initialized')

    // ============================================================
    // MODULE 1: Programs & Classes
    // ============================================================
    
    // Create program_category enum
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE program_category AS ENUM (
          'EARLY_DEVELOPMENT',
          'GYMNASTICS',
          'VORTEX_NINJA',
          'ATHLETICISM_ACCELERATOR',
          'ADULT_FITNESS',
          'HOMESCHOOL'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `)

    // Create skill_level enum
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE skill_level AS ENUM (
          'EARLY_STAGE',
          'BEGINNER',
          'INTERMEDIATE',
          'ADVANCED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `)

    // Create program table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS program (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        category            program_category NOT NULL,
        name                TEXT NOT NULL,
        display_name        TEXT NOT NULL,
        skill_level         skill_level,
        age_min             INTEGER,
        age_max             INTEGER,
        description         TEXT,
        skill_requirements  TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (facility_id, category, name)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_program_facility_category ON program(facility_id, category)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_program_skill_level ON program(skill_level)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_program_active ON program(is_active)`)

    // Create class table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
        name                TEXT NOT NULL,
        start_time          TIME NOT NULL,
        end_time            TIME NOT NULL,
        day_of_week         INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        max_capacity        INTEGER,
        current_enrollment  INTEGER NOT NULL DEFAULT 0,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_program ON class(program_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_day_time ON class(day_of_week, start_time)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_active ON class(is_active)`)

    // Create class_iteration table for multiple iterations per program
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_iteration (
        id                  BIGSERIAL PRIMARY KEY,
        program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
        iteration_number    INTEGER NOT NULL,
        days_of_week        INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK (array_length(days_of_week, 1) > 0),
        start_time          TIME NOT NULL DEFAULT '18:00:00',
        end_time            TIME NOT NULL DEFAULT '19:30:00',
        time_blocks         JSONB DEFAULT NULL,
        duration_type       VARCHAR(20) NOT NULL DEFAULT 'indefinite' CHECK (duration_type IN ('indefinite', '3_month_block', 'finite')),
        start_date          DATE,
        end_date            DATE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (program_id, iteration_number)
      )
    `)
    
    // Add time_blocks column if it doesn't exist (for existing tables)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'class_iteration' AND column_name = 'time_blocks'
        ) THEN
          ALTER TABLE class_iteration ADD COLUMN time_blocks JSONB DEFAULT NULL;
        END IF;
      END $$;
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_program ON class_iteration(program_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_number ON class_iteration(program_id, iteration_number)`)

    // Seed programs - Early Development
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'EARLY_DEVELOPMENT'::program_category,
        'dust_devils',
        'Dust Devils — Mommy & Me',
        'EARLY_STAGE'::skill_level,
        2,
        3,
        'Parent-assisted class focused on balance, coordination, rolling, jumping, and obstacle exploration in a safe, playful environment.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'dust_devils')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'EARLY_DEVELOPMENT'::program_category,
        'little_twisters_preschool',
        'Little Twisters — Preschool',
        'EARLY_STAGE'::skill_level,
        4,
        5,
        'Introductory gymnastics and athletic movement. Athletes build coordination, body awareness, and confidence using basic skills and equipment stations.',
        'Potty Trained'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'little_twisters_preschool')
    `)

    // Seed programs - Gymnastics
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'GYMNASTICS'::program_category,
        'tornadoes_gymnastics',
        'Tornadoes — Beginner',
        'BEGINNER'::skill_level,
        6,
        NULL,
        'Focus on foundational gymnastics skills including forward/backward rolls, cartwheels, handstands, bridges, round-offs, splits, and flexibility.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_gymnastics')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'GYMNASTICS'::program_category,
        'cyclones_gymnastics',
        'Cyclones — Intermediate',
        'INTERMEDIATE'::skill_level,
        6,
        NULL,
        'Athletes refine fundamentals and progress to front/back walkovers, handsprings, strength development, and controlled power.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_gymnastics')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'GYMNASTICS'::program_category,
        'vortex_a4_elite',
        'Vortex A4 Elite — Advanced',
        'ADVANCED'::skill_level,
        6,
        NULL,
        'Advanced training in multiple handsprings, flips, layouts, twisting, strength, flexibility, and elite-level execution.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_a4_elite')
    `)

    // Seed programs - Vortex Ninja
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'VORTEX_NINJA'::program_category,
        'tornadoes_ninja',
        'Tornadoes — Beginner Ninja',
        'BEGINNER'::skill_level,
        6,
        NULL,
        'Intro to ninja and parkour-style movement. Focus on agility, grip strength, coordination, and obstacle navigation.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_ninja')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'VORTEX_NINJA'::program_category,
        'cyclones_ninja',
        'Cyclones — Intermediate Ninja',
        'INTERMEDIATE'::skill_level,
        6,
        NULL,
        'Develop speed, strength, endurance, and technique across more complex ninja obstacles and movement challenges.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_ninja')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'VORTEX_NINJA'::program_category,
        'vortex_elite_ninja',
        'Vortex Elite — Advanced Ninja',
        'ADVANCED'::skill_level,
        6,
        NULL,
        'High-level ninja training emphasizing advanced obstacle combinations, explosive power, precision, and competitive readiness.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_elite_ninja')
    `)

    // Seed programs - Athleticism Accelerator
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'ATHLETICISM_ACCELERATOR'::program_category,
        'tornadoes_athleticism',
        'Tornadoes — Beginner',
        'BEGINNER'::skill_level,
        6,
        NULL,
        'Athletic fundamentals including speed mechanics, jumping/landing, core strength, mobility, and coordination.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'tornadoes_athleticism')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'ATHLETICISM_ACCELERATOR'::program_category,
        'cyclones_athleticism',
        'Cyclones — Intermediate',
        'INTERMEDIATE'::skill_level,
        6,
        NULL,
        'Strength, agility, power, and body control training to accelerate athletic performance across all sports.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'cyclones_athleticism')
    `)

    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'ATHLETICISM_ACCELERATOR'::program_category,
        'vortex_elite_athleticism',
        'Vortex Elite — Advanced',
        'ADVANCED'::skill_level,
        6,
        NULL,
        'High-performance training combining strength, speed, explosiveness, and movement efficiency for competitive athletes.',
        'Skill Evaluation Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'vortex_elite_athleticism')
    `)

    // Seed programs - Adult Fitness
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'ADULT_FITNESS'::program_category,
        'typhoons',
        'Typhoons — Adult Fitness',
        'BEGINNER'::skill_level,
        18,
        NULL,
        'Strength, conditioning, mobility, and introductory acrobatics in a progressive, supportive environment.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'typhoons')
    `)

    // Seed programs - Homeschool
    await pool.query(`
      INSERT INTO program (facility_id, category, name, display_name, skill_level, age_min, age_max, description, skill_requirements)
      SELECT 
        (SELECT id FROM facility LIMIT 1),
        'HOMESCHOOL'::program_category,
        'hurricane_academy',
        'Hurricane Academy — All Levels',
        NULL,
        6,
        NULL,
        'Development-based gymnastics and athletic training. Athletes progress by skill mastery rather than age or grade level.',
        'Daytime Program'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'hurricane_academy')
    `)

    console.log('✅ Module 1 (Programs & Classes) initialized')

    // ============================================================
    // MODULE 2: Unified Member Table (replaces app_user and athlete)
    // ============================================================
    
    // Create unified member table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        family_id           BIGINT REFERENCES family(id) ON DELETE SET NULL,
        
        -- Identity
        first_name          TEXT NOT NULL,
        last_name           TEXT NOT NULL,
        date_of_birth       DATE,  -- NULL for adults who don't need it
        email               TEXT,   -- NULL for children
        phone               TEXT,
        address             TEXT,   -- General address field
        
        -- Billing Address (from enrollment form)
        billing_street      TEXT,
        billing_city        TEXT,
        billing_state       TEXT,
        billing_zip         TEXT,
        
        -- Authentication (optional - children don't need login)
        password_hash       TEXT,   -- NULL if no login access
        username            TEXT,
        
        -- Status & Activity
        -- Status: 'legacy' (default), 'enrolled' (has enrollment), 'athlete' (enrolled + waivers), 'archived'
        status              VARCHAR(20) DEFAULT 'legacy' 
                            CHECK (status IN ('enrolled', 'legacy', 'archived', 'athlete')),
        is_active           BOOLEAN DEFAULT TRUE,
        family_is_active    BOOLEAN DEFAULT FALSE,  -- True if member or their family is active
        
        -- Parent/Guardian relationships (for children < 18)
        parent_guardian_ids BIGINT[],  -- Array of member IDs who are legal guardians
        
        -- Waiver/Participation forms (required for athlete status)
        has_completed_waivers BOOLEAN DEFAULT FALSE,
        waiver_completion_date TIMESTAMPTZ,
        
        -- Medical notes (for all members, not just athletes)
        medical_notes       TEXT,
        internal_flags      TEXT,
        
        -- Metadata
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    
    // Create indexes for member table
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_facility ON member(facility_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_family ON member(family_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_email ON member(email) WHERE email IS NOT NULL`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_status ON member(status)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_active ON member(is_active)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_family_active ON member(family_is_active)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_name ON member(last_name, first_name)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_parent_guardian_ids ON member USING GIN(parent_guardian_ids)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_waivers ON member(has_completed_waivers)`)
    
    // Add new columns if they don't exist (for existing databases)
    await pool.query(`
      ALTER TABLE member
      ADD COLUMN IF NOT EXISTS parent_guardian_ids BIGINT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS has_completed_waivers BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS waiver_completion_date TIMESTAMPTZ
    `)
    
    // Add unique constraint for email (only when email is not null)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'member_facility_email_unique'
        ) THEN
          CREATE UNIQUE INDEX member_facility_email_unique 
          ON member(facility_id, email) 
          WHERE email IS NOT NULL;
        END IF;
      END $$;
    `)
    
    // Create parent_guardian_authority table for legal authority
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parent_guardian_authority (
        id                  BIGSERIAL PRIMARY KEY,
        parent_member_id    BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        child_member_id     BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        has_legal_authority BOOLEAN NOT NULL DEFAULT TRUE,
        relationship        TEXT,  -- e.g., 'Parent', 'Guardian', 'Legal Guardian'
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        
        -- Ensure unique parent-child relationship
        UNIQUE (parent_member_id, child_member_id)
      )
    `)
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parent_guardian_parent ON parent_guardian_authority(parent_member_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parent_guardian_child ON parent_guardian_authority(child_member_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parent_guardian_legal ON parent_guardian_authority(has_legal_authority)`)
    
    // Create family table (simplified - no primary member concept)
    // Family is just a linking ID - all members in family are equal
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        family_name         TEXT NOT NULL,
        family_username     TEXT UNIQUE,  -- Unique username for family joining
        family_password_hash TEXT,  -- Hashed password for family joining
        archived            BOOLEAN NOT NULL DEFAULT FALSE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_facility ON family(facility_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_username ON family(family_username) WHERE family_username IS NOT NULL`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_name ON family(family_name)`)
    
    // Migrate existing data: Add new columns if they don't exist
    await pool.query(`
      ALTER TABLE family 
      ADD COLUMN IF NOT EXISTS family_username TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS family_password_hash TEXT
    `)
    
    // Remove primary_user_id/primary_member_id if they exist (keep for backward compatibility but don't use)
    // Note: These columns may still exist from old schema but will be ignored
    
    // Create family_guardian junction table (supports both old and new)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family_guardian (
        family_id           BIGINT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
        user_id             BIGINT REFERENCES app_user(id) ON DELETE CASCADE,
        member_id           BIGINT REFERENCES member(id) ON DELETE CASCADE,
        is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (family_id, COALESCE(member_id, user_id))
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_guardian_family ON family_guardian(family_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_guardian_user ON family_guardian(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_guardian_member ON family_guardian(member_id)`)
    
    // Create member_program table (replaces athlete_program)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_program (
        id                  BIGSERIAL PRIMARY KEY,
        member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
        iteration_id        BIGINT REFERENCES class_iteration(id) ON DELETE CASCADE,
        days_per_week       INTEGER NOT NULL,
        selected_days       JSONB,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (member_id, program_id, iteration_id)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_member ON member_program(member_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_program ON member_program(program_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_iteration ON member_program(iteration_id)`)
    
    // Create emergency_contact table (uses member table only)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contact (
        id                  BIGSERIAL PRIMARY KEY,
        member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        name                TEXT NOT NULL,
        relationship        TEXT,
        phone               TEXT NOT NULL,
        email               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_emergency_contact_member ON emergency_contact(member_id)`)
    
    // Function to update family_is_active status
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_family_active_status()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update all members in the same family
        UPDATE member
        SET family_is_active = TRUE,
            status = CASE 
              WHEN status = 'archived' THEN 'archived'
              WHEN status = 'enrolled' THEN 'enrolled'
              ELSE 'family_active'
            END
        WHERE family_id = NEW.family_id
          AND (NEW.family_is_active = TRUE OR NEW.is_active = TRUE);
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
    
    // Trigger to update family_is_active when member is updated
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_update_family_active ON member;
      CREATE TRIGGER trigger_update_family_active
      AFTER UPDATE OF is_active, family_is_active ON member
      FOR EACH ROW
      WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.family_is_active IS DISTINCT FROM NEW.family_is_active)
      EXECUTE FUNCTION update_family_active_status();
    `)
    
    // Function to calculate and set family_is_active based on family status
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_family_active_status()
      RETURNS void AS $$
      BEGIN
        -- Set family_is_active = TRUE for all members in families where at least one member is active
        UPDATE member m1
        SET family_is_active = TRUE,
            status = CASE 
              WHEN m1.status = 'archived' THEN 'archived'
              WHEN m1.status = 'enrolled' THEN 'enrolled'
              WHEN EXISTS (
                SELECT 1 FROM member m2 
                WHERE m2.family_id = m1.family_id 
                AND m2.is_active = TRUE
                AND m2.id != m1.id
              ) THEN 'family_active'
              ELSE m1.status
            END
        WHERE EXISTS (
          SELECT 1 FROM member m2 
          WHERE m2.family_id = m1.family_id 
          AND m2.is_active = TRUE
          AND m2.id != m1.id
        );
      END;
      $$ LANGUAGE plpgsql;
    `)
    
    // Keep legacy tables for backward compatibility during migration
    // These will be dropped after migration is complete
    
    console.log('✅ Module 2 (Unified Member Table) initialized')

    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization error:', error)
  }
}

// Validation schemas
const registrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).optional().allow('', null),
  athleteAge: Joi.number().integer().min(5).max(18).optional().allow(null, ''),
  interests: Joi.string().max(500).optional().allow(''),
  message: Joi.string().max(1000).optional().allow('')
})

const newsletterSchema = Joi.object({
  email: Joi.string().email().required()
})

// Legacy memberSchema removed - old /api/admin/members endpoints removed
// Members are now managed through /api/admin/families which uses app_user, family, and athlete tables

const memberLoginSchema = Joi.object({
  emailOrUsername: Joi.string().required(),
  password: Joi.string().required()
})

const eventSchema = Joi.object({
  eventName: Joi.string().min(1).max(255).required(),
  shortDescription: Joi.string().min(1).required(),
  longDescription: Joi.string().min(1).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().optional().allow(null),
  type: Joi.string().valid('camp', 'class', 'event', 'watch-party').optional().default('event'),
  address: Joi.string().max(500).optional().allow('', null),
  datesAndTimes: Joi.array().items(Joi.object({
    date: Joi.date().required(),
    startTime: Joi.string().optional().allow(''),
    endTime: Joi.string().optional().allow(''),
    description: Joi.string().optional().allow(''),
    allDay: Joi.boolean().optional()
  })).optional().default([]),
  keyDetails: Joi.array().items(Joi.string()).optional().default([]),
  images: Joi.array().items(Joi.string()).optional().default([]),
  adminEmail: Joi.string().email().optional(),
  adminName: Joi.string().optional(),
  tagType: Joi.string().valid('all_classes_and_parents', 'specific_classes', 'specific_categories', 'all_parents', 'boosters', 'volunteers').optional().default('all_classes_and_parents'),
  tagClassIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
  tagCategoryIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
  tagAllParents: Joi.boolean().optional().default(false),
  tagBoosters: Joi.boolean().optional().default(false),
  tagVolunteers: Joi.boolean().optional().default(false)
})

const adminLoginSchema = Joi.object({
  usernameOrEmail: Joi.string().required(),
  password: Joi.string().required()
})

const adminSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).optional().allow('', null),
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required()
})

const adminUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().max(20).optional().allow('', null),
  username: Joi.string().min(3).max(50).optional(),
  password: Joi.string().min(6).optional()
})

const programUpdateSchema = Joi.object({
  displayName: Joi.string().min(1).max(255).optional(),
  categoryId: Joi.number().integer().optional().allow(null),
  skillLevel: Joi.string().valid('EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED').optional().allow(null),
  ageMin: Joi.number().integer().min(0).max(100).optional().allow(null),
  ageMax: Joi.number().integer().min(0).max(100).optional().allow(null),
  description: Joi.string().optional().allow('', null),
  skillRequirements: Joi.string().optional().allow('', null),
  isActive: Joi.boolean().optional(),
  archived: Joi.boolean().optional()
})

const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional().allow('', null)
})

const categoryUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  displayName: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional().allow('', null),
  archived: Joi.boolean().optional()
})

const levelSchema = Joi.object({
  categoryId: Joi.number().integer().required(),
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(255).required()
})

const levelUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  displayName: Joi.string().min(1).max(255).optional(),
  archived: Joi.boolean().optional()
})

const programSchema = Joi.object({
  categoryId: Joi.number().integer().optional(),
  category: Joi.string().optional(),
  name: Joi.string().min(1).max(255).optional(),
  displayName: Joi.string().min(1).max(255).required(),
  skillLevel: Joi.string().valid('EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED').optional().allow(null),
  levelId: Joi.number().integer().optional().allow(null),
  ageMin: Joi.number().integer().min(0).optional().allow(null),
  ageMax: Joi.number().integer().min(0).optional().allow(null),
  description: Joi.string().optional().allow('', null),
  skillRequirements: Joi.string().optional().allow('', null),
  isActive: Joi.boolean().optional()
})

// Module 2: Family and Athlete Schemas
const familySchema = Joi.object({
  familyName: Joi.string().max(255).optional().allow('', null),
  primaryUserId: Joi.number().integer().optional().allow(null),
  guardianIds: Joi.array().items(Joi.number().integer()).optional().default([])
})

const athleteSchema = Joi.object({
  familyId: Joi.number().integer().optional().allow(null), // Will be auto-created if not provided for adults
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  dateOfBirth: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null).custom((value, helpers) => {
      // Allow empty string or null for adults who don't need DOB
      if (!value || value.trim() === '') {
        return null
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return helpers.error('any.invalid', { message: 'dateOfBirth must be a valid date' })
      }
      return date
    })
  ).optional().allow(null, '').messages({
    'any.invalid': 'dateOfBirth must be a valid date'
  }),
  medicalNotes: Joi.string().max(2000).optional().allow('', null),
  internalFlags: Joi.string().max(500).optional().allow('', null),
  userId: Joi.number().integer().optional().allow(null) // If set, links athlete to an app_user (e.g., parent who trains)
})

const athleteUpdateSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  dateOfBirth: Joi.date().optional(),
  medicalNotes: Joi.string().max(2000).optional().allow('', null),
  internalFlags: Joi.string().max(500).optional().allow('', null)
})

const emergencyContactSchema = Joi.object({
  memberId: Joi.number().integer().required(),
  name: Joi.string().min(1).max(200).required(),
  relationship: Joi.string().max(100).optional().allow('', null),
  phone: Joi.string().max(20).required(),
  email: Joi.string().email().optional().allow('', null)
})

// ============================================================
// ROLE MANAGEMENT SYSTEM
// ============================================================
// Role System Overview:
// - OWNER_ADMIN: System administrators with full access
// - COACH: Staff members who can manage classes and athletes
// - PARENT_GUARDIAN: Adults who can manage family accounts, enroll members, 
//                   sign documents, add family members, and edit family information.
//                   All adults in a family should have this role.
// - ATHLETE_VIEWER: Read-only access for viewing athlete information
// - ATHLETE: Anyone enrolled in a class (adults or children). This role is 
//            automatically assigned when someone enrolls in a class.
//
// Key Rules:
// 1. All adults in a family must have PARENT_GUARDIAN role
// 2. When a person enrolls in a class, they get ATHLETE role (in addition to any existing roles)
// 3. Adults can have both PARENT_GUARDIAN and ATHLETE roles simultaneously
// 4. A child cannot be a sole member - at least one adult guardian must exist
// 5. Creating a "New Family" = creating a new member with no linked family
// 6. Non-participants are simply adults without ATHLETE role (they can enroll later)
// ============================================================

// Helper functions for role management
const getUserRoles = async (userId) => {
  try {
    // Check if user_role table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_role'
      )
    `)
    
    const hasUserRoleTable = tableCheck.rows[0].exists
    
    if (hasUserRoleTable) {
      // Try querying user_role table first
      try {
        const result = await pool.query(`
          SELECT role FROM user_role WHERE user_id = $1
        `, [userId])
        if (result.rows.length > 0) {
          return result.rows.map(row => row.role)
        }
      } catch (userRoleError) {
        // If query fails, continue to fallback
        console.warn('Error querying user_role table:', userRoleError.message)
      }
    }
    
    // Fallback to single role from app_user (if table exists)
    try {
      const appUserCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'app_user'
        )
      `)
      
      if (appUserCheck.rows[0].exists) {
        const result = await pool.query('SELECT role FROM app_user WHERE id = $1', [userId])
        if (result.rows.length > 0 && result.rows[0].role) {
          return [result.rows[0].role]
        }
      }
    } catch (fallbackError) {
      // If app_user doesn't exist or query fails, return empty array
      console.warn('Error querying app_user table:', fallbackError.message)
    }
    
    return []
  } catch (error) {
    console.error('Error getting user roles:', error.message)
    return []
  }
}

const userHasRole = async (userId, role) => {
  const roles = await getUserRoles(userId)
  return roles.includes(role)
}

const userHasAnyRole = async (userId, roles) => {
  const userRoles = await getUserRoles(userId)
  return roles.some(role => userRoles.includes(role))
}

const addUserRole = async (userId, role) => {
  try {
    await pool.query(`
      INSERT INTO user_role (user_id, role)
      VALUES ($1, $2::user_role)
      ON CONFLICT (user_id, role) DO NOTHING
    `, [userId, role])
    return true
  } catch (error) {
    console.error('Error adding user role:', error)
    return false
  }
}

const removeUserRole = async (userId, role) => {
  try {
    await pool.query('DELETE FROM user_role WHERE user_id = $1 AND role = $2::user_role', [userId, role])
    return true
  } catch (error) {
    console.error('Error removing user role:', error)
    return false
  }
}

const setUserRoles = async (userId, roles) => {
  try {
    // Remove all existing roles from junction table
    await pool.query('DELETE FROM user_role WHERE user_id = $1', [userId])
    // Add new roles
    for (const role of roles) {
      await pool.query(`
        INSERT INTO user_role (user_id, role)
        VALUES ($1, $2::user_role)
        ON CONFLICT (user_id, role) DO NOTHING
      `, [userId, role])
    }
    // Update primary role in app_user table (use first role or keep existing)
    if (roles.length > 0) {
      await pool.query('UPDATE app_user SET role = $1::user_role WHERE id = $2', [roles[0], userId])
    }
    return true
  } catch (error) {
    console.error('Error setting user roles:', error)
    return false
  }
}

// Middleware to verify JWT token (member or admin)
const authenticateMember = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]
  
  if (!token) {
    console.log('[AUTH] No token provided in request to:', req.path)
    return res.status(401).json({ success: false, message: 'No token provided' })
  }

  // TEMPORARY: Handle temporary client-side tokens until backend is fully deployed
  // This allows enrollment to work even if backend login hasn't been updated yet
  if (token.startsWith('temp-admin-')) {
    console.warn('[AUTH] Using temporary token - backend login endpoint needs to be updated!')
    const parts = token.split('-')
    if (parts.length >= 3) {
      const adminId = parseInt(parts[2])
      req.userId = adminId
      req.memberId = adminId
      req.isAdmin = true
      console.log('[AUTH] Authenticated with temporary token:', { userId: adminId, isAdmin: true })
      return next()
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    console.log('[AUTH] Token decoded successfully:', { 
      userId: decoded.userId, 
      memberId: decoded.memberId, 
      adminId: decoded.adminId,
      role: decoded.role,
      path: req.path 
    })
    // Support both old (memberId) and new (userId) token formats
    req.userId = decoded.userId || decoded.memberId || decoded.adminId
    req.memberId = decoded.userId || decoded.memberId // For backward compatibility
    req.isAdmin = decoded.role === 'ADMIN' || decoded.adminId !== undefined
    console.log('[AUTH] Authenticated:', { userId: req.userId, isAdmin: req.isAdmin })
    next()
  } catch (error) {
    console.error('[AUTH] Token verification failed:', {
      error: error.message,
      errorName: error.name,
      path: req.path,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 20) + '...'
    })
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Test endpoint to verify routing works
app.get('/api/test-enrollment-route', (req, res) => {
  console.log('[Test] Test enrollment route endpoint hit')
  res.json({ success: true, message: 'Enrollment route test - routing is working' })
})

// Module 0 verification endpoint
app.get('/api/verify/module0', async (req, res) => {
  try {
    const results = {
      userRoleEnum: false,
      facilityTable: false,
      facilityData: null,
      appUserTable: false,
      migratedAdmins: { count: 0, sample: [] },
      migratedMembers: { count: 0, sample: [] },
      adminTableCount: 0,
      memberTableCount: 0
    }

    // Check user_role enum
    try {
      const enumCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'user_role'
        )
      `)
      results.userRoleEnum = enumCheck.rows[0].exists
    } catch (error) {
      console.error('Error checking user_role enum:', error.message)
    }

    // Check facility table
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'facility'
        )
      `)
      results.facilityTable = tableCheck.rows[0].exists
      
      if (results.facilityTable) {
        const facilityData = await pool.query('SELECT * FROM facility')
        results.facilityData = facilityData.rows
      }
    } catch (error) {
      console.error('Error checking facility:', error.message)
    }

    // Check app_user table
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'app_user'
        )
      `)
      results.appUserTable = tableCheck.rows[0].exists
      
      if (results.appUserTable) {
        // Count admins
        const adminCheck = await pool.query(`
          SELECT COUNT(*) as count FROM app_user WHERE role = 'OWNER_ADMIN'
        `)
        results.migratedAdmins.count = parseInt(adminCheck.rows[0].count)
        
        const adminSample = await pool.query(`
          SELECT id, email, full_name, role, is_active 
          FROM app_user 
          WHERE role = 'OWNER_ADMIN' 
          LIMIT 5
        `)
        results.migratedAdmins.sample = adminSample.rows

        // Count members
        const memberCheck = await pool.query(`
          SELECT COUNT(*) as count FROM app_user WHERE role = 'PARENT_GUARDIAN'
        `)
        results.migratedMembers.count = parseInt(memberCheck.rows[0].count)
        
        const memberSample = await pool.query(`
          SELECT id, email, full_name, role, is_active 
          FROM app_user 
          WHERE role = 'PARENT_GUARDIAN' 
          LIMIT 5
        `)
        results.migratedMembers.sample = memberSample.rows
      }
    } catch (error) {
      console.error('Error checking app_user:', error.message)
    }

    // Check original table counts for comparison
    try {
      const adminCount = await pool.query('SELECT COUNT(*) as count FROM admins')
      results.adminTableCount = parseInt(adminCount.rows[0].count)
    } catch (error) {
      // admins table might not exist, that's OK
    }

    // Legacy members table check removed - table is deprecated

    // Determine overall status
    const criticalPassed = results.userRoleEnum && results.facilityTable && results.appUserTable
    const allPassed = criticalPassed && results.facilityData && results.facilityData.length > 0

    res.json({
      success: true,
      status: allPassed ? 'complete' : (criticalPassed ? 'partial' : 'incomplete'),
      results,
      summary: {
        message: allPassed 
          ? '✅ Module 0 migration is complete!' 
          : criticalPassed 
            ? '⚠️ Core tables created, but some data may be missing'
            : '❌ Module 0 migration appears incomplete',
        recommendations: allPassed 
          ? ['Migration successful! You can proceed with Module 1.']
          : criticalPassed
            ? ['Core migration completed. Check if you have existing admins/members to migrate.']
            : ['Please restart your server to run the migration.', 'Check server logs for errors.']
      }
    })
  } catch (error) {
    console.error('Verification error:', error)
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    })
  }
})

// Module 1 verification endpoint
app.get('/api/verify/module1', async (req, res) => {
  try {
    const results = {
      programCategoryEnum: false,
      skillLevelEnum: false,
      programTable: false,
      classTable: false,
      programCount: 0,
      programsByCategory: {},
      samplePrograms: []
    }

    // Check program_category enum
    try {
      const enumCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'program_category'
        )
      `)
      results.programCategoryEnum = enumCheck.rows[0].exists
    } catch (error) {
      console.error('Error checking program_category enum:', error.message)
    }

    // Check skill_level enum
    try {
      const enumCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'skill_level'
        )
      `)
      results.skillLevelEnum = enumCheck.rows[0].exists
    } catch (error) {
      console.error('Error checking skill_level enum:', error.message)
    }

    // Check program table
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'program'
        )
      `)
      results.programTable = tableCheck.rows[0].exists
      
      if (results.programTable) {
        const countResult = await pool.query('SELECT COUNT(*) as count FROM program')
        results.programCount = parseInt(countResult.rows[0].count)
        
        const categoryResult = await pool.query(`
          SELECT category, COUNT(*) as count 
          FROM program 
          GROUP BY category 
          ORDER BY category
        `)
        categoryResult.rows.forEach(row => {
          results.programsByCategory[row.category] = parseInt(row.count)
        })
        
        const sampleResult = await pool.query(`
          SELECT category, display_name, skill_level, age_min, age_max 
          FROM program 
          ORDER BY category, display_name 
          LIMIT 10
        `)
        results.samplePrograms = sampleResult.rows
      }
    } catch (error) {
      console.error('Error checking program table:', error.message)
    }

    // Check class table
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'class'
        )
      `)
      results.classTable = tableCheck.rows[0].exists
    } catch (error) {
      console.error('Error checking class table:', error.message)
    }

    // Determine overall status
    const criticalPassed = results.programCategoryEnum && results.skillLevelEnum && results.programTable && results.classTable
    const allPassed = criticalPassed && results.programCount >= 14

    res.json({
      success: true,
      status: allPassed ? 'complete' : (criticalPassed ? 'partial' : 'incomplete'),
      results,
      summary: {
        message: allPassed 
          ? '✅ Module 1 migration is complete!' 
          : criticalPassed 
            ? '⚠️ Core tables created, but some programs may be missing'
            : '❌ Module 1 migration appears incomplete',
        recommendations: allPassed 
          ? ['Migration successful! All 14 programs have been created.']
          : criticalPassed
            ? ['Core migration completed. Check if all programs were seeded correctly.']
            : ['Please restart your server to run the migration.', 'Check server logs for errors.']
      }
    })
  } catch (error) {
    console.error('Verification error:', error)
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    })
  }
})

// Submit registration
app.post('/api/registrations', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registrationSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Check if email already exists
    const existingRegistration = await pool.query(
      'SELECT id FROM registrations WHERE email = $1',
      [value.email]
    )

    if (existingRegistration.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      })
    }

    // Insert registration
    const result = await pool.query(`
      INSERT INTO registrations 
      (first_name, last_name, email, phone, athlete_age, interests, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      value.firstName,
      value.lastName,
      value.email,
      value.phone || null,
      value.athleteAge || null,
      value.interests || null,
      value.message || null
    ])

    res.json({
      success: true,
      message: 'Registration submitted successfully',
      id: result.rows[0].id
    })

  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Subscribe to newsletter
app.post('/api/newsletter', async (req, res) => {
  try {
    // Validate input
    const { error, value } = newsletterSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      })
    }

    // Check if email already exists
    const existingSubscriber = await pool.query(
      'SELECT id FROM newsletter_subscribers WHERE email = $1',
      [value.email]
    )

    if (existingSubscriber.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already subscribed'
      })
    }

    // Insert subscriber
    await pool.query(
      'INSERT INTO newsletter_subscribers (email) VALUES ($1)',
      [value.email]
    )

    res.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    })

  } catch (error) {
    console.error('Newsletter subscription error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get registrations (admin endpoint - in production, add authentication)
app.get('/api/admin/registrations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM registrations 
      WHERE archived IS NOT true
      ORDER BY created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get registrations error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get newsletter subscribers (admin endpoint)
app.get('/api/admin/newsletter', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM newsletter_subscribers 
      ORDER BY created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get subscribers error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update registration (admin endpoint)
app.put('/api/admin/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { first_name, last_name, email, phone, athlete_age, interests, message } = req.body

    await pool.query(`
      UPDATE registrations 
      SET first_name = $1, last_name = $2, email = $3, phone = $4, athlete_age = $5, interests = $6, message = $7
      WHERE id = $8
    `, [first_name, last_name, email, phone, athlete_age, interests, message, id])

    res.json({
      success: true,
      message: 'Registration updated successfully'
    })
  } catch (error) {
    console.error('Update registration error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/Delete registration (admin endpoint)
app.delete('/api/admin/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params
    // Instead of deleting, we'll mark as archived (soft delete)
    await pool.query(`
      UPDATE registrations 
      SET archived = true
      WHERE id = $1
    `, [id])

    res.json({
      success: true,
      message: 'Registration archived successfully'
    })
  } catch (error) {
    console.error('Archive registration error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// ========== MEMBER ENDPOINTS ==========

// ========== MODULE 2: UNIFIED MEMBER ENDPOINTS ==========

// Get all members (admin endpoint) - unified endpoint for all members
// Returns all members from the unified member table, showing active/archived status
app.get('/api/admin/members', async (req, res) => {
  console.log('[GET /api/admin/members] ===== ENDPOINT CALLED =====')
  console.log('[GET /api/admin/members] Full request query:', req.query)
  try {
    const { search, showArchived, role } = req.query
    console.log('[GET /api/admin/members] Raw query params:', { search, showArchived, role, showArchivedType: typeof showArchived })
    const showArchivedBool = showArchived === 'true' || showArchived === true
    console.log('[GET /api/admin/members] showArchivedBool calculated as:', showArchivedBool)
    
    console.log('[GET /api/admin/members] Request received:', { search, showArchived, role, showArchivedBool })
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    console.log('[GET /api/admin/members] Member table exists:', hasMemberTable)
    
    if (!hasMemberTable) {
      console.log('[GET /api/admin/members] Member table does not exist, returning empty array')
      return res.json({
        success: true,
        data: []
      })
    }
    
    // Check if facility_id column exists in member table
    const facilityColumnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
        AND column_name = 'facility_id'
      )
    `)
    
    const hasFacilityColumn = facilityColumnCheck.rows[0].exists
    let facilityId = null
    
    console.log('[GET /api/admin/members] Has facility_id column:', hasFacilityColumn)
    
    if (hasFacilityColumn) {
      const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
      if (facilityResult.rows.length > 0) {
        facilityId = facilityResult.rows[0].id
        console.log('[GET /api/admin/members] Found facility_id:', facilityId)
      } else {
        console.log('[GET /api/admin/members] No facility found in database')
      }
    }
    
    // Check if user_role table has member_id column
    const userRoleMemberIdCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_role'
        AND column_name = 'member_id'
      )
    `)
    
    const userRoleHasMemberId = userRoleMemberIdCheck.rows[0].exists
    
    // Build base query - simplified to avoid complex joins that might fail
    let query = `
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.phone,
        m.address,
        m.billing_street,
        m.billing_city,
        m.billing_state,
        m.billing_zip,
        m.date_of_birth,
        m.medical_notes,
        m.internal_flags,
        m.status,
        m.is_active,
        m.family_is_active,
        m.family_id,
        m.username,
        m.created_at,
        m.updated_at,
        f.family_name,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      WHERE 1=1
    `
    
    const params = []
    let paramCount = 0
    
    // Add facility filter if facility_id column exists and we have a facility
    // Note: We only filter by facility_id if we have a valid facility ID
    // If no facility exists, we return ALL members (don't filter by facility_id)
    // This ensures we can see members even if facility setup is incomplete
    if (hasFacilityColumn && facilityId !== null && facilityId !== undefined) {
      paramCount++
      query += ` AND m.facility_id = $${paramCount}`
      params.push(facilityId)
      console.log('[GET /api/admin/members] Filtering by facility_id:', facilityId)
    } else {
      // Don't filter by facility_id - return all members
      console.log('[GET /api/admin/members] Not filtering by facility_id - returning all members')
    }
    
    // Filter by active/archived
    if (!showArchivedBool) {
      query += ` AND m.is_active = TRUE`
    }
    
    // Search filter
    if (search) {
      paramCount++
      query += ` AND (
        m.first_name ILIKE $${paramCount} OR 
        m.last_name ILIKE $${paramCount} OR 
        COALESCE(m.email, '') ILIKE $${paramCount} OR
        COALESCE(m.phone, '') ILIKE $${paramCount} OR
        COALESCE(f.family_name, '') ILIKE $${paramCount}
      )`
      params.push(`%${search}%`)
    }
    
    // Role filter (if member has this role) - only if user_role has member_id
    if (role && userRoleHasMemberId) {
      paramCount++
      query += ` AND EXISTS (
        SELECT 1 FROM user_role ur 
        WHERE ur.member_id = m.id AND ur.role = $${paramCount}::user_role
      )`
      params.push(role)
    }
    
    query += ` ORDER BY m.last_name, m.first_name`
    
    console.log('[GET /api/admin/members] Executing query:', query)
    console.log('[GET /api/admin/members] Query params:', params)
    console.log('[GET /api/admin/members] showArchivedBool:', showArchivedBool)
    
    // First, let's check how many total members exist (for debugging)
    try {
      const totalMembersCheck = await pool.query('SELECT COUNT(*) as total FROM member')
      console.log('[GET /api/admin/members] Total members in database:', totalMembersCheck.rows[0].total)
      
      const activeMembersCheck = await pool.query('SELECT COUNT(*) as total FROM member WHERE is_active = TRUE')
      console.log('[GET /api/admin/members] Active members in database:', activeMembersCheck.rows[0].total)
      
      // Also get a sample of member IDs to verify data exists
      const sampleCheck = await pool.query('SELECT id, first_name, last_name, is_active FROM member LIMIT 3')
      console.log('[GET /api/admin/members] Sample members:', sampleCheck.rows)
    } catch (dbError) {
      console.error('[GET /api/admin/members] Error checking member counts:', dbError.message)
    }
    
    const result = await pool.query(query, params)
    
    console.log('[GET /api/admin/members] Query returned', result.rows.length, 'members')
    
    // Get enrollments separately to avoid complex joins
    const memberIds = result.rows.map(row => row.id)
    let enrollmentsMap = {}
    
    if (memberIds.length > 0) {
      const enrollmentsQuery = `
        SELECT 
          mp.member_id,
          json_agg(
            jsonb_build_object(
              'id', mp.id,
              'program_id', mp.program_id,
              'program_display_name', COALESCE(p.display_name, ''),
              'days_per_week', mp.days_per_week,
              'selected_days', mp.selected_days
            )
          ) as enrollments
        FROM member_program mp
        LEFT JOIN program p ON mp.program_id = p.id
        WHERE mp.member_id = ANY($1::bigint[])
        GROUP BY mp.member_id
      `
      const enrollmentsResult = await pool.query(enrollmentsQuery, [memberIds])
      
      enrollmentsResult.rows.forEach(row => {
        enrollmentsMap[row.member_id] = row.enrollments || []
      })
    }
    
    // Get roles separately if user_role has member_id
    let rolesMap = {}
    if (userRoleHasMemberId && memberIds.length > 0) {
      const rolesQuery = `
        SELECT 
          member_id,
          json_agg(
            jsonb_build_object(
              'id', role,
              'role', role
            )
          ) as roles
        FROM user_role
        WHERE member_id = ANY($1::bigint[])
        GROUP BY member_id
      `
      const rolesResult = await pool.query(rolesQuery, [memberIds])
      
      rolesResult.rows.forEach(row => {
        rolesMap[row.member_id] = row.roles || []
      })
    }
    
    // Format the response
    const members = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      billingStreet: row.billing_street,
      billingCity: row.billing_city,
      billingState: row.billing_state,
      billingZip: row.billing_zip,
      dateOfBirth: row.date_of_birth,
      age: row.age ? parseInt(row.age) : null,
      medicalNotes: row.medical_notes,
      internalFlags: row.internal_flags,
      status: row.status,
      isActive: row.is_active,
      familyIsActive: row.family_is_active,
      familyId: row.family_id,
      familyName: row.family_name,
      username: row.username,
      roles: rolesMap[row.id] || [],
      enrollments: enrollmentsMap[row.id] || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    console.log('[GET /api/admin/members] Returning', members.length, 'formatted members')
    
    res.json({
      success: true,
      data: members
    })
  } catch (error) {
    console.error('Get members error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Archive/Unarchive member (admin endpoint)
app.patch('/api/admin/members/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body
    
    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    
    if (hasMemberTable) {
      // Update member is_active (archived = true means is_active = false)
      await pool.query(`
        UPDATE member 
        SET is_active = $1, 
            status = CASE 
              WHEN $1 = FALSE AND status = 'archived' THEN 'legacy'
              WHEN $1 = FALSE THEN status
              ELSE 'archived'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [!archived, id])
      
      // Update family_is_active for all family members
      const memberResult = await pool.query(`
        SELECT family_id FROM member WHERE id = $1
      `, [id])
      
      if (memberResult.rows.length > 0 && memberResult.rows[0].family_id) {
        const familyId = memberResult.rows[0].family_id
        // Recalculate family_is_active for all members in this family
        await pool.query(`
          UPDATE member
          SET family_is_active = EXISTS (
            SELECT 1 FROM member m2 
            WHERE m2.family_id = $1 
            AND m2.is_active = TRUE
          ),
          status = CASE 
            WHEN is_active = FALSE THEN 'archived'
            WHEN status = 'archived' THEN 'archived'
            WHEN EXISTS (
              SELECT 1 FROM member m2 
              WHERE m2.family_id = $1 
              AND m2.is_active = TRUE
              AND m2.id != member.id
            ) THEN 'family_active'
            WHEN EXISTS (
              SELECT 1 FROM member_program mp WHERE mp.member_id = member.id
            ) THEN 'enrolled'
            ELSE 'legacy'
          END
          WHERE family_id = $1
        `, [familyId])
      }
      
      // Get updated member
      const result = await pool.query(`
        SELECT * FROM member WHERE id = $1
      `, [id])
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        })
      }
      
      res.json({
        success: true,
        message: archived ? 'Member archived successfully' : 'Member unarchived successfully',
        data: result.rows[0]
      })
    } else {
      // Fallback to legacy tables
      // Try to update in app_user first
      const userResult = await pool.query(`
        UPDATE app_user 
        SET is_active = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [!archived, id])
      
      if (userResult.rows.length > 0) {
        res.json({
          success: true,
          message: archived ? 'User archived successfully' : 'User unarchived successfully',
          data: userResult.rows[0]
        })
      } else {
        // Member table doesn't exist - return error (shouldn't happen in production)
        res.status(404).json({
          success: false,
          message: 'Member table not found'
        })
      }
    }
  } catch (error) {
    console.error('Archive member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Legacy endpoints kept for backward compatibility
// The old members table has been replaced by app_user, family, and athlete tables

// ========== MODULE 2: FAMILY & ATHLETE ENDPOINTS ==========

// Get all users (admin endpoint) - for selecting existing users when creating athletes
app.get('/api/admin/users', async (req, res) => {
  try {
    const { role, search } = req.query
    let query = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.is_active,
        u.username,
        f.id as family_id,
        f.family_name
      FROM app_user u
      LEFT JOIN family f ON u.id = f.primary_user_id
      WHERE u.facility_id = (SELECT id FROM facility LIMIT 1)
    `
    const params = []
    let paramCount = 0
    
    if (role) {
      paramCount++
      query += ` AND u.role = $${paramCount}::user_role`
      params.push(role)
    }
    
    if (search) {
      paramCount++
      query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.username ILIKE $${paramCount})`
      params.push(`%${search}%`)
    }
    
    query += ` ORDER BY u.full_name`
    
    const result = await pool.query(query, params)
    
    // Get all roles for each user
    const usersWithRoles = await Promise.all(result.rows.map(async (user) => {
      const roles = await getUserRoles(user.id)
      return {
        ...user,
        roles: roles
      }
    }))
    
    res.json({
      success: true,
      data: usersWithRoles
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create app_user (admin endpoint) - for creating parent/guardian accounts
app.post('/api/admin/users', async (req, res) => {
  try {
    const { fullName, email, phone, password, role, roles, username, address } = req.body
    // Support both single role (backward compatibility) and multiple roles
    const userRoles = roles && Array.isArray(roles) ? roles : (role ? [role] : ['PARENT_GUARDIAN'])
    
    if (!fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name and password are required'
      })
    }

    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id

    // Check if username column exists, if not add it
    const usernameColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'app_user' AND column_name = 'username'
    `)
    
    if (usernameColumnCheck.rows.length === 0) {
      await pool.query('ALTER TABLE app_user ADD COLUMN username VARCHAR(50)')
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_username ON app_user(facility_id, username)')
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await pool.query(
        'SELECT id FROM app_user WHERE facility_id = $1 AND LOWER(username) = LOWER($2)',
        [facilityId, username]
      )

      if (existingUsername.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        })
      }
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingUser = await pool.query(
        'SELECT id, is_active FROM app_user WHERE facility_id = $1 AND email = $2',
        [facilityId, email]
      )

      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0]
        
        // If user exists and is archived (is_active = false or null), check for action parameter
        // Explicitly check for false or null to handle archived users
        const isArchived = user.is_active === false || user.is_active === null
        
        if (isArchived) {
          const { action } = req.body
          
          // If no action specified, return special response to prompt user choice
          if (!action || (action !== 'create_new' && action !== 'revive')) {
            // Log for debugging
            if (process.env.NODE_ENV !== 'production') {
              console.log('Archived user detected:', { userId: user.id, email, is_active: user.is_active })
            }
            return res.status(409).json({
              success: false,
              message: 'Email already registered (archived account)',
              archived: true,
              userId: user.id
            })
          }
          
          // Handle archived user based on action
          const userId = user.id
          
          // Hash password
          const passwordHash = await bcrypt.hash(password, 10)
          
          if (action === 'create_new') {
            // Remove user from their previous family
            await pool.query(`
              UPDATE family SET primary_user_id = NULL WHERE primary_user_id = $1
            `, [userId])
            
            // Remove user from all family_guardian relationships
            await pool.query(`
              DELETE FROM family_guardian WHERE user_id = $1
            `, [userId])
          }
          // For 'revive', we keep the existing family associations (do nothing)
          
          // Update user info and reactivate
          const primaryRole = userRoles[0] || 'PARENT_GUARDIAN'
          await pool.query(`
            UPDATE app_user 
            SET full_name = $1, 
                phone = $2, 
                password_hash = $3, 
                is_active = TRUE,
                role = $4::user_role,
                username = $5,
                address = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
          `, [fullName, phone || null, passwordHash, primaryRole, username || null, req.body.address || null, userId])
          
          // Update user roles
          await setUserRoles(userId, userRoles)
          
          // Fetch user with all roles
          const allRoles = await getUserRoles(userId)
          const updatedUser = await pool.query(`
            SELECT id, email, full_name, phone, role, is_active, created_at, username, address
            FROM app_user
            WHERE id = $1
          `, [userId])
          
          const userData = {
            ...updatedUser.rows[0],
            roles: allRoles
          }
          
          return res.json({
            success: true,
            message: action === 'create_new' 
              ? 'User account updated and removed from previous family' 
              : 'User account revived successfully',
            data: userData
          })
        } else {
          // User exists and is active - also show dialog to let them choose
          const { action } = req.body
          
          // If no action specified, return special response to prompt user choice
          if (!action || (action !== 'create_new' && action !== 'revive')) {
            // Log for debugging
            if (process.env.NODE_ENV !== 'production') {
              console.log('Active user detected (not archived):', { userId: user.id, email, is_active: user.is_active })
            }
            return res.status(409).json({
              success: false,
              message: 'Email already registered',
              archived: false,
              userId: user.id
            })
          }
          
          // Handle active user based on action
          const userId = user.id
          
          // Hash password
          const passwordHash = await bcrypt.hash(password, 10)
          
          if (action === 'create_new') {
            // Remove user from their previous family
            await pool.query(`
              UPDATE family SET primary_user_id = NULL WHERE primary_user_id = $1
            `, [userId])
            
            // Remove user from all family_guardian relationships
            await pool.query(`
              DELETE FROM family_guardian WHERE user_id = $1
            `, [userId])
          }
          // For 'revive', we keep the existing family associations (do nothing)
          
          // Update user info (keep is_active = true for active users)
          const primaryRole = userRoles[0] || 'PARENT_GUARDIAN'
          await pool.query(`
            UPDATE app_user 
            SET full_name = $1, 
                phone = $2, 
                password_hash = $3, 
                role = $4::user_role,
                username = $5,
                address = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
          `, [fullName, phone || null, passwordHash, primaryRole, username || null, req.body.address || null, userId])
          
          // Update user roles
          await setUserRoles(userId, userRoles)
          
          // Fetch user with all roles
          const allRoles = await getUserRoles(userId)
          const updatedUser = await pool.query(`
            SELECT id, email, full_name, phone, role, is_active, created_at, username
            FROM app_user
            WHERE id = $1
          `, [userId])
          
          const userData = {
            ...updatedUser.rows[0],
            roles: allRoles
          }
          
          return res.json({
            success: true,
            message: action === 'create_new' 
              ? 'User account updated and removed from previous family' 
              : 'User account updated successfully',
            data: userData
          })
        }
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with primary role (first role in array or single role)
    const primaryRole = userRoles[0] || 'PARENT_GUARDIAN'
    const result = await pool.query(`
      INSERT INTO app_user (facility_id, role, email, phone, full_name, password_hash, is_active, username, address)
      VALUES ($1, $2::user_role, $3, $4, $5, $6, TRUE, $7, $8)
      RETURNING id, email, full_name, phone, role, is_active, created_at, username, address
    `, [facilityId, primaryRole, email || null, phone || null, fullName, passwordHash, username || null, address || null])

    const userId = result.rows[0].id

    // Add all roles to user_role table
    await setUserRoles(userId, userRoles)

    // Fetch user with all roles
    const allRoles = await getUserRoles(userId)
    const userData = {
      ...result.rows[0],
      roles: allRoles
    }

    res.json({
      success: true,
      message: 'User created successfully',
      data: userData
    })
  } catch (error) {
    console.error('Create user error:', error)
    console.error('Error stack:', error.stack)
    // Ensure CORS headers are set even on error
    const origin = req.headers.origin
    if (origin && isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Archive/Unarchive user (admin endpoint) - sets is_active = false/true
app.patch('/api/admin/users/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body

    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }

    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id FROM app_user WHERE id = $1 AND facility_id = $2',
      [id, facilityId]
    )

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Update is_active (when archived = true, set is_active = false, and vice versa)
    await pool.query(
      'UPDATE app_user SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [!archived, id]
    )
    
    // Update athlete status for all athletes linked to this user
    // If archiving: set status to 'archived'
    // If unarchiving: set status based on enrollments ('enrolled' if has enrollments, else 'legacy')
    // Update member status when user is archived/unarchived
    const memberStatusUpdate = archived 
      ? "UPDATE member SET status = 'archived', is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1"
      : `UPDATE member SET 
          status = CASE
            WHEN EXISTS (SELECT 1 FROM member_program WHERE member_id = member.id) 
            THEN 'enrolled'
            ELSE 'legacy'
          END,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`
    
    await pool.query(memberStatusUpdate, [id])
    
    // Also update members that are in families where this user is a guardian
    if (archived) {
      await pool.query(`
        UPDATE member m
        SET status = 'archived', is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        FROM family f
        JOIN family_guardian fg ON f.id = fg.family_id
        WHERE m.family_id = f.id AND (fg.user_id = $1 OR fg.member_id = $1)
      `, [id])
    }

    // Fetch updated user
    const result = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_active, u.created_at, u.username, u.address
      FROM app_user u
      WHERE u.id = $1
    `, [id])

    const userData = result.rows[0]
    const allRoles = await getUserRoles(parseInt(id))
    userData.roles = allRoles

    res.json({
      success: true,
      message: archived ? 'User archived successfully' : 'User unarchived successfully',
      data: userData
    })
  } catch (error) {
    console.error('Archive user error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get single user by ID (admin endpoint)
app.get('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.is_active,
        u.username,
        u.created_at,
        u.address,
        f.id as family_id,
        f.family_name
      FROM app_user u
      LEFT JOIN family f ON u.id = f.primary_user_id
      WHERE u.id = $1 AND u.facility_id = (SELECT id FROM facility LIMIT 1)
    `, [id])
    
    if (result.rows.length === 0) {
      setCorsHeaders(req, res)
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    // Get all roles for the user
    const roles = await getUserRoles(parseInt(id))
    const userData = {
      ...result.rows[0],
      roles: roles
    }
    
    res.json({
      success: true,
      data: userData
    })
  } catch (error) {
    console.error('Get user error:', error)
    console.error('Error stack:', error.stack)
    setCorsHeaders(req, res)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update user by ID (admin endpoint)
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { fullName, email, phone, password, username, roles, role, address } = req.body
    // Support both single role (backward compatibility) and multiple roles
    const userRoles = roles && Array.isArray(roles) ? roles : (role ? [role] : null)
    
    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id FROM app_user WHERE id = $1 AND facility_id = $2',
      [id, facilityId]
    )
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    // Check if username column exists
    const usernameColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'app_user' AND column_name = 'username'
    `)
    
    if (usernameColumnCheck.rows.length === 0) {
      await pool.query('ALTER TABLE app_user ADD COLUMN username VARCHAR(50)')
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_username ON app_user(facility_id, username)')
    }
    
    // Check if username already exists (if provided and different from current)
    if (username) {
      const currentUser = await pool.query(
        'SELECT username FROM app_user WHERE id = $1',
        [id]
      )
      const currentUsername = currentUser.rows[0]?.username
      
      if (username !== currentUsername) {
        const existingUsername = await pool.query(
          'SELECT id FROM app_user WHERE facility_id = $1 AND LOWER(username) = LOWER($2) AND id != $3',
          [facilityId, username, id]
        )
        
        if (existingUsername.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Username already taken'
          })
        }
      }
    }
    
    // Check if email already exists (if provided and different from current)
    if (email) {
      const currentUser = await pool.query(
        'SELECT email FROM app_user WHERE id = $1',
        [id]
      )
      const currentEmail = currentUser.rows[0]?.email
      
      if (email !== currentEmail) {
        const existingEmail = await pool.query(
          'SELECT id FROM app_user WHERE facility_id = $1 AND email = $2 AND id != $3',
          [facilityId, email, id]
        )
        
        if (existingEmail.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Email already registered'
          })
        }
      }
    }
    
    // Build update query dynamically
    const updates = []
    const params = []
    let paramCount = 0
    
    if (fullName !== undefined) {
      paramCount++
      updates.push(`full_name = $${paramCount}`)
      params.push(fullName)
    }
    
    if (email !== undefined) {
      paramCount++
      updates.push(`email = $${paramCount}`)
      params.push(email)
    }
    
    if (phone !== undefined) {
      paramCount++
      updates.push(`phone = $${paramCount}`)
      params.push(phone)
    }
    
    if (username !== undefined) {
      paramCount++
      updates.push(`username = $${paramCount}`)
      params.push(username)
    }
    
    if (password) {
      paramCount++
      const passwordHash = await bcrypt.hash(password, 10)
      updates.push(`password_hash = $${paramCount}`)
      params.push(passwordHash)
    }
    
    if (address !== undefined) {
      paramCount++
      updates.push(`address = $${paramCount}`)
      params.push(address || null)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }
    
    paramCount++
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(id)
    
    const updateQuery = `
      UPDATE app_user 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND facility_id = $${paramCount + 1}
      RETURNING id, email, full_name, phone, role, is_active, created_at, username, address
    `
    params.push(facilityId)
    
    const result = await pool.query(updateQuery, params)
    
    // Update roles if provided
    if (userRoles) {
      await setUserRoles(parseInt(id), userRoles)
      // Update primary role in app_user if roles were provided
      if (userRoles.length > 0) {
        await pool.query('UPDATE app_user SET role = $1::user_role WHERE id = $2', [userRoles[0], id])
      }
    }
    
    // Get all roles for the user
    const allRoles = await getUserRoles(parseInt(id))
    const userData = {
      ...result.rows[0],
      roles: allRoles
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: userData
    })
  } catch (error) {
    console.error('Update user error:', error)
    console.error('Error stack:', error.stack)
    const origin = req.headers.origin
    if (origin && isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get all families (admin endpoint)
app.get('/api/admin/families', async (req, res) => {
  try {
    const { search, primaryUserId } = req.query
    // Ensure required columns exist before querying
    await pool.query('ALTER TABLE family ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE')
    await pool.query('ALTER TABLE athlete ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'legacy\'')
    
    let query = `
      SELECT 
        f.id,
        f.facility_id,
        f.primary_user_id,
        f.family_name,
        COALESCE(f.archived, FALSE) as archived,
        f.created_at,
        f.updated_at,
        u.email as primary_email,
        u.full_name as primary_name,
        u.phone as primary_phone,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', g.user_id,
              'email', gu.email,
              'fullName', gu.full_name,
              'phone', gu.phone,
              'isPrimary', g.is_primary
            )
          ) FILTER (WHERE g.user_id IS NOT NULL),
          '[]'
        ) as guardians,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', m.id,
              'firstName', m.first_name,
              'lastName', m.last_name,
              'dateOfBirth', m.date_of_birth,
              'age', CASE WHEN m.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER ELSE NULL END,
              'medicalNotes', m.medical_notes,
              'internalFlags', m.internal_flags,
              'status', m.status,
              'familyId', m.family_id,
              'familyDisplay', CASE WHEN m.family_id IS NULL THEN 'Orphan' ELSE CAST(m.family_id AS TEXT) END,
              'isActive', m.is_active
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as members
      FROM family f
      LEFT JOIN app_user u ON f.primary_user_id = u.id
      LEFT JOIN family_guardian g ON f.id = g.family_id
      LEFT JOIN app_user gu ON g.user_id = gu.id
      LEFT JOIN member m ON f.id = m.family_id AND m.is_active = TRUE
    `
    const params = []
    const conditions = []
    
    if (primaryUserId) {
      conditions.push(`f.primary_user_id = $${params.length + 1}`)
      params.push(primaryUserId)
    }
    
    if (search) {
      conditions.push(`(f.family_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1} OR u.full_name ILIKE $${params.length + 1})`)
      params.push(`%${search}%`)
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
    
    // Group by all non-aggregated columns. PostgreSQL handles NULLs in GROUP BY naturally
    query += ` GROUP BY f.id, f.facility_id, f.primary_user_id, f.family_name, f.archived, f.created_at, f.updated_at, u.email, u.full_name, u.phone ORDER BY f.created_at DESC`
    
    const result = await pool.query(query, params)
    
    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get families error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get single family (admin endpoint)
app.get('/api/admin/families/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const familyResult = await pool.query(`
      SELECT 
        f.*,
        u.id as primary_user_id,
        u.email as primary_email,
        u.full_name as primary_name,
        u.phone as primary_phone,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', g.user_id,
              'email', gu.email,
              'fullName', gu.full_name,
              'phone', gu.phone,
              'isPrimary', g.is_primary
            )
          ) FILTER (WHERE g.user_id IS NOT NULL),
          '[]'
        ) as guardians
      FROM family f
      LEFT JOIN app_user u ON f.primary_user_id = u.id
      LEFT JOIN family_guardian g ON f.id = g.family_id
      LEFT JOIN app_user gu ON g.user_id = gu.id
      WHERE f.id = $1
      GROUP BY f.id, u.id
    `, [id])
    
    if (familyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    const family = familyResult.rows[0]
    
    // Get members for this family
    const membersResult = await pool.query(`
      SELECT 
        m.*,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', ec.id,
              'name', ec.name,
              'relationship', ec.relationship,
              'phone', ec.phone,
              'email', ec.email
            )
          ) FILTER (WHERE ec.id IS NOT NULL),
          '[]'
        ) as emergency_contacts
      FROM member m
      LEFT JOIN emergency_contact ec ON m.id = ec.member_id
      WHERE m.family_id = $1 AND m.is_active = TRUE
      GROUP BY m.id
      ORDER BY m.date_of_birth NULLS LAST
    `, [id])
    
    family.members = membersResult.rows
    
    res.json({
      success: true,
      data: family
    })
  } catch (error) {
    console.error('Get family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create family (admin endpoint)
app.post('/api/admin/families', async (req, res) => {
  try {
    const { error, value } = familySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Create family
    const familyResult = await pool.query(`
      INSERT INTO family (facility_id, primary_user_id, family_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [facilityId, value.primaryUserId || null, value.familyName || null])
    
    const familyId = familyResult.rows[0].id
    
    // Link guardians if provided
    if (value.guardianIds && value.guardianIds.length > 0) {
      for (let i = 0; i < value.guardianIds.length; i++) {
        const userId = value.guardianIds[i]
        const isPrimary = i === 0 && !value.primaryUserId
        
        // Ensure all guardians have PARENT_GUARDIAN role
        await addUserRole(userId, 'PARENT_GUARDIAN')
        
        await pool.query(`
          INSERT INTO family_guardian (family_id, user_id, is_primary)
          VALUES ($1, $2, $3)
          ON CONFLICT (family_id, user_id) DO NOTHING
        `, [familyId, userId, isPrimary])
      }
      
      // Update primary_user_id if not set
      if (!value.primaryUserId && value.guardianIds.length > 0) {
        await pool.query(`
          UPDATE family SET primary_user_id = $1 WHERE id = $2
        `, [value.guardianIds[0], familyId])
      }
    }
    
    // Fetch complete family data
    const completeFamily = await pool.query(`
      SELECT 
        f.*,
        u.id as primary_user_id,
        u.email as primary_email,
        u.full_name as primary_name,
        u.phone as primary_phone,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', g.user_id,
              'email', gu.email,
              'fullName', gu.full_name,
              'phone', gu.phone,
              'isPrimary', g.is_primary
            )
          ) FILTER (WHERE g.user_id IS NOT NULL),
          '[]'
        ) as guardians
      FROM family f
      LEFT JOIN app_user u ON f.primary_user_id = u.id
      LEFT JOIN family_guardian g ON f.id = g.family_id
      LEFT JOIN app_user gu ON g.user_id = gu.id
      WHERE f.id = $1
      GROUP BY f.id, u.id
    `, [familyId])
    
    res.json({
      success: true,
      message: 'Family created successfully',
      data: completeFamily.rows[0]
    })
  } catch (error) {
    console.error('Create family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update family (admin endpoint)
app.put('/api/admin/families/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = familySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Update family
    await pool.query(`
      UPDATE family 
      SET family_name = $1, primary_user_id = $2, updated_at = now()
      WHERE id = $3
    `, [value.familyName || null, value.primaryUserId || null, id])
    
    // Update guardians if provided
    if (value.guardianIds !== undefined) {
      // Remove all existing guardians
      await pool.query('DELETE FROM family_guardian WHERE family_id = $1', [id])
      
      // Add new guardians
      if (value.guardianIds.length > 0) {
        for (let i = 0; i < value.guardianIds.length; i++) {
          const userId = value.guardianIds[i]
          const isPrimary = i === 0
          
          // Ensure all guardians have PARENT_GUARDIAN role
          await addUserRole(userId, 'PARENT_GUARDIAN')
          
          await pool.query(`
            INSERT INTO family_guardian (family_id, user_id, is_primary)
            VALUES ($1, $2, $3)
          `, [id, userId, isPrimary])
        }
        
        // Update primary_user_id
        await pool.query(`
          UPDATE family SET primary_user_id = $1 WHERE id = $2
        `, [value.guardianIds[0], id])
      }
    }
    
    res.json({
      success: true,
      message: 'Family updated successfully'
    })
  } catch (error) {
    console.error('Update family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/unarchive family (admin endpoint)
app.patch('/api/admin/families/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body
    
    // Get facility ID
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Check if archived column exists, if not add it
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'family' AND column_name = 'archived'
    `)
    
    if (columnCheck.rows.length === 0) {
      await pool.query('ALTER TABLE family ADD COLUMN archived BOOLEAN DEFAULT FALSE')
    }
    
    // Get all user IDs associated with this family
    const familyUsersResult = await pool.query(`
      SELECT DISTINCT user_id 
      FROM family_guardian 
      WHERE family_id = $1
      UNION
      SELECT primary_user_id 
      FROM family 
      WHERE id = $1 AND primary_user_id IS NOT NULL
    `, [id])
    
    const userIds = familyUsersResult.rows.map(row => row.user_id).filter(userId => userId !== null)
    
    // Start a transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Update family archived status
      await client.query('UPDATE family SET archived = $1, updated_at = now() WHERE id = $2', [archived, id])
      
      // Archive/unarchive associated users
      if (userIds.length > 0) {
        // Update is_active (when archived = true, set is_active = false, and vice versa)
        await client.query(
          'UPDATE app_user SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::bigint[])',
          [!archived, userIds]
        )
      }
      
      // Update member status for all members in this family
      if (archived) {
        // Set status to 'archived'
        await client.query(`
          UPDATE member 
          SET status = 'archived', is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
          WHERE family_id = $1 AND facility_id = $2
        `, [id, facilityId])
      } else {
        // Set status based on enrollments ('enrolled' if has enrollments, else 'legacy')
        await client.query(`
          UPDATE member 
          SET status = CASE
            WHEN EXISTS (SELECT 1 FROM member_program WHERE member_id = member.id) 
            THEN 'enrolled'
            ELSE 'legacy'
          END,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
          WHERE family_id = $1 AND facility_id = $2
        `, [id, facilityId])
      }
      
      // Also update members linked to users in this family
      if (userIds.length > 0) {
        if (archived) {
          await client.query(`
            UPDATE member 
            SET status = 'archived', is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ANY($1::bigint[]) AND facility_id = $2
          `, [userIds, facilityId])
        } else {
          await client.query(`
            UPDATE member 
            SET status = CASE
              WHEN EXISTS (SELECT 1 FROM member_program WHERE member_id = member.id) 
              THEN 'enrolled'
              ELSE 'legacy'
            END,
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ANY($1::bigint[]) AND facility_id = $2
          `, [userIds, facilityId])
        }
      }
      
      await client.query('COMMIT')
      
      res.json({
        success: true,
        message: archived ? 'Family archived successfully' : 'Family unarchived successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Archive family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Delete family (admin endpoint)
app.delete('/api/admin/families/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Get facility ID
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Get all user IDs associated with this family
    const familyUsersResult = await pool.query(`
      SELECT DISTINCT user_id 
      FROM family_guardian 
      WHERE family_id = $1
      UNION
      SELECT primary_user_id 
      FROM family 
      WHERE id = $1 AND primary_user_id IS NOT NULL
    `, [id])
    
    const userIds = familyUsersResult.rows.map(row => row.user_id).filter(id => id !== null)
    
    // Get all member IDs associated with this family
    const membersResult = await pool.query(`
      SELECT id FROM member WHERE family_id = $1 AND facility_id = $2
    `, [id, facilityId])
    const memberIds = membersResult.rows.map(row => row.id)
    
    // Start a transaction to ensure all deletions succeed or fail together
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Delete members first (they have foreign key references)
      if (memberIds.length > 0) {
        await client.query(`
          DELETE FROM member WHERE id = ANY($1::bigint[])
        `, [memberIds])
      }
      
      // Delete the family (this will cascade delete family_guardian records)
      await client.query('DELETE FROM family WHERE id = $1', [id])
      
      // Delete associated users, but only if they're not associated with other families
      const deletedUserEmails = []
      for (const userId of userIds) {
        // Check if this user is associated with any other families
        const otherFamiliesResult = await client.query(`
          SELECT COUNT(*) as count
          FROM (
            SELECT family_id FROM family_guardian WHERE user_id = $1
            UNION
            SELECT id FROM family WHERE primary_user_id = $1
          ) as other_families
        `, [userId])
        
        const otherFamiliesCount = parseInt(otherFamiliesResult.rows[0].count)
        
        // Only delete the user if they're not associated with any other families
        if (otherFamiliesCount === 0) {
          // Get user email before deleting
          const userEmailResult = await client.query('SELECT email FROM app_user WHERE id = $1', [userId])
          if (userEmailResult.rows.length > 0) {
            deletedUserEmails.push(userEmailResult.rows[0].email)
          }
          await client.query('DELETE FROM app_user WHERE id = $1', [userId])
        }
      }
      
      // Legacy members table cleanup removed - table is deprecated
      
      await client.query('COMMIT')
      
      res.json({
        success: true,
        message: 'Family and associated members deleted successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Delete family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Temporary cleanup endpoint: Delete user by email (admin only - remove after cleanup)
app.delete('/api/admin/users/by-email/:email', async (req, res) => {
  try {
    const { email } = req.params
    const decodedEmail = decodeURIComponent(email)
    
    // Get facility ID
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Find the user
    const userResult = await pool.query(
      'SELECT id, email, full_name FROM app_user WHERE email = $1 AND facility_id = $2',
      [decodedEmail, facilityId]
    )
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    const user = userResult.rows[0]
    const userId = user.id
    
    // Get all family IDs associated with this user
    const familiesResult = await pool.query(`
      SELECT DISTINCT family_id as id FROM family_guardian WHERE user_id = $1
      UNION
      SELECT id FROM family WHERE primary_user_id = $1
    `, [userId])
    
    const familyIds = familiesResult.rows.map(row => row.id)
    
    // Start a transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Delete members in associated families
      if (familyIds.length > 0) {
        for (const familyId of familyIds) {
          const membersResult = await client.query(
            'SELECT id FROM member WHERE family_id = $1 AND facility_id = $2',
            [familyId, facilityId]
          )
          const memberIds = membersResult.rows.map(row => row.id)
          
          if (memberIds.length > 0) {
            await client.query(
              'DELETE FROM member WHERE id = ANY($1::bigint[])',
              [memberIds]
            )
          }
        }
        
        // Delete families
        await client.query('DELETE FROM family WHERE id = ANY($1::bigint[])', [familyIds])
      }
      
      // Delete the user
      await client.query('DELETE FROM app_user WHERE id = $1', [userId])
      
      // Legacy members table cleanup removed - table is deprecated
      
      await client.query('COMMIT')
      
      res.json({
        success: true,
        message: `User ${decodedEmail} and associated data deleted successfully`
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Delete user by email error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Search members for enrollment (admin endpoint) - only returns active members
// This is used when searching for members to enroll in classes
app.get('/api/admin/search-members', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        users: []
      })
    }
    
    const searchQuery = q.trim()
    
    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    
    if (hasMemberTable) {
      // Use unified member table - only return active members
      const result = await pool.query(`
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          m.phone,
          m.date_of_birth,
          m.family_id,
          f.family_name,
          EXTRACT(YEAR FROM AGE(m.date_of_birth)) as age
        FROM member m
        LEFT JOIN family f ON m.family_id = f.id
        WHERE m.facility_id = $1
          AND m.is_active = TRUE
          AND (
            m.first_name ILIKE $2 OR 
            m.last_name ILIKE $2 OR 
            m.email ILIKE $2 OR
            m.phone ILIKE $2 OR
            (m.first_name || ' ' || m.last_name) ILIKE $2
          )
        ORDER BY m.last_name, m.first_name
        LIMIT 50
      `, [facilityId, `%${searchQuery}%`])
      
      const users = result.rows.map(row => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        user_id: row.id, // For backward compatibility
        age: row.age ? parseInt(row.age) : null,
        family_id: row.family_id,
        family_name: row.family_name
      }))
      
      res.json({
        success: true,
        users: users,
        data: users // Also include as 'data' for backward compatibility
      })
    } else {
      // Fallback: if member table doesn't exist, return empty (shouldn't happen in production)
      res.json({
        success: true,
        users: [],
        data: []
      })
    }
  } catch (error) {
    console.error('Search members error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Search users by name, phone, or email (admin endpoint) - legacy endpoint, redirects to search-members
app.get('/api/admin/search-users', async (req, res) => {
  try {
    const { q } = req.query
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json({
        success: true,
        users: []
      })
    }
    
    const searchQuery = q.trim()
    
    // Normalize phone number - strip all non-numeric characters
    const normalizePhone = (phone) => phone.replace(/\D/g, '')
    const isPhoneNumber = /^\d+$/.test(normalizePhone(searchQuery)) && normalizePhone(searchQuery).length >= 7
    
    // If it looks like a phone number, search with normalized version
    const phoneSearchTerm = isPhoneNumber ? normalizePhone(searchQuery) : searchQuery
    const nameSearchTerm = `%${searchQuery}%`
    const phoneSearchTermPattern = `%${phoneSearchTerm}%`
    
    // Search in members and app_user using unified member table
    // For phone numbers, also search normalized version
    let result
    try {
      const query = `
        SELECT DISTINCT
          COALESCE(m.id, u.id) as id,
          COALESCE(
            m.first_name, 
            CASE 
              WHEN u.full_name IS NOT NULL AND u.full_name != '' 
              THEN TRIM(SPLIT_PART(u.full_name, ' ', 1))
              ELSE NULL 
            END
          ) as first_name,
          COALESCE(
            m.last_name,
            CASE 
              WHEN u.full_name IS NOT NULL AND u.full_name != '' 
              THEN TRIM(SPLIT_PART(u.full_name, ' ', 2))
              ELSE NULL 
            END
          ) as last_name,
          COALESCE(m.email, u.email) as email,
          COALESCE(m.phone, u.phone) as phone,
          m.id as member_id,
          u.id as user_id,
          u.id as user_id_from_user,
          COALESCE(m.first_name || ' ' || m.last_name, u.full_name, '') as full_name_for_sort
        FROM app_user u
        FULL OUTER JOIN member m ON m.id = u.id
        WHERE 
          (COALESCE(u.full_name, '') ILIKE $1 OR COALESCE(u.email, '') ILIKE $1 OR COALESCE(m.email, '') ILIKE $1)
          OR (COALESCE(m.first_name, '') ILIKE $1 OR COALESCE(m.last_name, '') ILIKE $1)
          OR (
            COALESCE(u.phone, '') ILIKE $1 
            OR COALESCE(m.phone, '') ILIKE $1
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '-', ''), '(', ''), ')', ''), ' ', ''), '.', '') ILIKE $2
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(m.phone, ''), '-', ''), '(', ''), ')', ''), ' ', ''), '.', '') ILIKE $2
          )
          AND (u.is_active = TRUE OR m.is_active = TRUE OR (u.id IS NULL AND m.id IS NOT NULL))
        ORDER BY full_name_for_sort, first_name, last_name
        LIMIT 50
      `
      
      result = await pool.query(query, [nameSearchTerm, phoneSearchTermPattern])
    } catch (queryError) {
      console.error('Search users query error:', queryError)
      console.error('Query params:', { nameSearchTerm, phoneSearchTermPattern })
      throw queryError
    }
    
    const users = result.rows.map(row => ({
      id: row.user_id_from_user || row.user_id || row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || null,
      phone: row.phone || null,
      user_id: row.user_id_from_user || row.user_id || null
    }))
    
    res.json({
      success: true,
      users: users
    })
  } catch (error) {
    console.error('Search users error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})


// Get single member (admin endpoint) - renamed from athletes to members
app.get('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const query = `
      SELECT 
        m.*,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        CASE 
          WHEN m.family_id IS NULL THEN 'Orphan'
          ELSE f.family_name
        END as family_name,
        CASE 
          WHEN m.family_id IS NULL THEN NULL
          ELSE f.id
        END as family_id,
        CASE 
          WHEN m.family_id IS NULL THEN 'Orphan'
          ELSE CAST(f.id AS TEXT)
        END as family_display,
        u.email as primary_guardian_email,
        u.full_name as primary_guardian_name
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      LEFT JOIN app_user u ON f.primary_user_id = u.id OR f.primary_member_id = m.id
      WHERE m.id = $1
    `
    
    const memberResult = await pool.query(query, [id])
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const member = memberResult.rows[0]
    
    // Get emergency contacts using member_id
    const contactsResult = await pool.query(`
      SELECT * FROM emergency_contact WHERE member_id = $1 ORDER BY created_at
    `, [id])
    
    member.emergency_contacts = contactsResult.rows
    
    res.json({
      success: true,
      data: member
    })
  } catch (error) {
    console.error('Get member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create member (admin endpoint) - renamed from athletes to members
app.post('/api/admin/members', async (req, res) => {
  try {
    const { error, value } = athleteSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Get facility - check if facility table exists first
    let facilityId = null
    const facilityTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'facility'
      )
    `)
    
    if (facilityTableCheck.rows[0].exists) {
      let facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
      if (facilityResult.rows.length > 0) {
        facilityId = facilityResult.rows[0].id
      } else {
        // No facility exists - create a default one
        try {
          const defaultFacilityResult = await pool.query(`
            INSERT INTO facility (name, timezone)
            VALUES ('Vortex Athletics', 'America/New_York')
            RETURNING id
          `)
          facilityId = defaultFacilityResult.rows[0].id
          console.log('[POST /api/admin/members] Created default facility:', facilityId)
        } catch (facilityError) {
          console.error('[POST /api/admin/members] Error creating default facility:', facilityError.message)
          return res.status(500).json({
            success: false,
            message: 'No facility exists and could not create default facility. Please create a facility first.'
          })
        }
      }
    } else {
      // Facility table doesn't exist - member table requires facility_id
      // Check if member table has facility_id as NOT NULL
      const memberFacilityCheck = await pool.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
        AND column_name = 'facility_id'
      `)
      
      if (memberFacilityCheck.rows.length > 0 && memberFacilityCheck.rows[0].is_nullable === 'NO') {
        return res.status(500).json({
          success: false,
          message: 'Member table requires facility_id but facility table does not exist. Please run database migrations.'
        })
      }
    }
    
    // Verify family exists (only if familyId is provided)
    if (value.familyId) {
      const familyCheck = await pool.query('SELECT id FROM family WHERE id = $1', [value.familyId])
      if (familyCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Family not found'
        })
      }
    }
    
    // Validate that family has at least one adult guardian
    // A child cannot be a sole member - a parent must exist
    let guardianCount = 0
    let hasPrimaryGuardian = false
    
    if (value.familyId) {
      try {
        const guardianCheck = await pool.query(`
          SELECT COUNT(*) as guardian_count
          FROM family_guardian fg
          JOIN app_user u ON fg.user_id = u.id
          WHERE fg.family_id = $1
        `, [value.familyId])
        
        guardianCount = parseInt(guardianCheck.rows[0]?.guardian_count || '0')
        
        // Check if primary_user_id is set and is a guardian
        const primaryUserCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM family f
          JOIN app_user u ON f.primary_user_id = u.id
          WHERE f.id = $1 AND f.primary_user_id IS NOT NULL
        `, [value.familyId])
        
        hasPrimaryGuardian = parseInt(primaryUserCheck.rows[0]?.count || '0') > 0
      } catch (guardianError) {
        // If tables don't exist, skip guardian check
        console.warn('Error checking guardians (tables may not exist):', guardianError.message)
      }
    }
    
    // Calculate age from date of birth to determine if this is a child
    // If DOB is not provided, assume adult (age >= 18)
    let age = 18 // Default to adult if no DOB
    if (value.dateOfBirth) {
      const birthDate = new Date(value.dateOfBirth)
      const today = new Date()
      age = today.getFullYear() - birthDate.getFullYear() - 
        (today.getMonth() < birthDate.getMonth() || 
         (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
    }
    
    // Adults must have a family_id (family of 1 is allowed)
    // Children can be orphaned (family_id = NULL) or have a family
    if (!value.familyId) {
      if (value.dateOfBirth && age < 18) {
        // Children without family_id are orphans - this is allowed
        // They can be created as orphans or assigned to a family later
        value.familyId = null
      } else if (age >= 18 && value.userId) {
        // Adults must have a family - auto-create one for them (family of 1)
        // Check if user already has a family
        const existingFamilyCheck = await pool.query(`
          SELECT f.id FROM family f
          WHERE f.primary_user_id = $1 OR EXISTS (
            SELECT 1 FROM family_guardian fg WHERE fg.user_id = $1 AND fg.family_id = f.id
          )
          LIMIT 1
        `, [value.userId])
        
        if (existingFamilyCheck.rows.length === 0) {
          // Create a family for this adult (family of 1)
          // Only create family if facility exists, otherwise set familyId to null
          if (facilityId) {
            const newFamilyResult = await pool.query(`
              INSERT INTO family (facility_id, primary_user_id, family_name)
              VALUES ($1, $2, $3)
              RETURNING id
            `, [facilityId, value.userId, `${value.firstName} ${value.lastName} Family`])
            
            const newFamilyId = newFamilyResult.rows[0].id
            
            // Try to add as guardian to new family (if table exists)
            try {
              await pool.query(`
                INSERT INTO family_guardian (family_id, user_id, is_primary)
                VALUES ($1, $2, TRUE)
              `, [newFamilyId, value.userId])
            } catch (guardianError) {
              console.warn('Error adding guardian (table may not exist):', guardianError.message)
            }
            
            // Update familyId for the athlete
            value.familyId = newFamilyId
          } else {
            // No facility, set familyId to null (orphan adult)
            value.familyId = null
          }
        } else {
          // Use existing family
          value.familyId = existingFamilyCheck.rows[0].id
        }
      } else {
        // Adult without userId - still need a family (shouldn't happen in normal flow, but handle it)
        return res.status(400).json({
          success: false,
          message: 'Adults must have a family. Please provide a family_id or create a user account first.'
        })
      }
    }
    
    // If this is a child (under 18) with a family_id, ensure there are guardians in the family
    if (value.dateOfBirth && age < 18 && value.familyId && guardianCount === 0 && !hasPrimaryGuardian) {
      return res.status(400).json({
        success: false,
        message: 'A child cannot be in a family without guardians. At least one adult guardian must exist in the family, or create the child as an orphan.'
      })
    }
    
    // Create member with status (default to 'legacy', will be updated if enrollments exist)
    // Note: family_id can be NULL for adults who create their own account independently
    // Note: date_of_birth can be NULL for adults who don't need it
    // Note: facility_id can be NULL if facility table doesn't exist or no facility is set
    const insertQuery = `
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, date_of_birth, 
        medical_notes, internal_flags, status, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'legacy', TRUE)
      RETURNING *
    `
    const insertParams = [
      facilityId || null, // Can be NULL if no facility exists
      value.familyId || null, // Can be NULL for orphaned children or adults
      value.firstName,
      value.lastName,
      value.dateOfBirth && value.dateOfBirth !== '' ? value.dateOfBirth : null, // Allow NULL for adults
      value.medicalNotes || null,
      value.internalFlags || null
    ]
    
    const memberResult = await pool.query(insertQuery, insertParams)
    
    const member = memberResult.rows[0]
    
    // Add computed age
    if (member.date_of_birth) {
      const ageResult = await pool.query(`
        SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) as age 
        FROM member WHERE id = $1
      `, [member.id])
      member.age = ageResult.rows.length > 0 ? parseInt(ageResult.rows[0].age) : null
    } else {
      member.age = null
    }
    
    res.json({
      success: true,
      message: 'Member created successfully',
      data: member
    })
  } catch (error) {
    console.error('Create athlete error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Helper function to update member status based on enrollments and family activity
const updateMemberStatus = async (memberId) => {
  try {
    // Check if member has any enrollments using member_program table
    const enrollmentCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM member_program
      WHERE member_id = $1
    `, [memberId])
    
    const hasEnrollments = parseInt(enrollmentCheck.rows[0].count) > 0
    
    // Get member's current status and family info
    const memberCheck = await pool.query(`
      SELECT status, is_active, family_id, family_is_active 
      FROM member 
      WHERE id = $1
    `, [memberId])
    
    if (memberCheck.rows.length === 0) return
    
    const currentStatus = memberCheck.rows[0].status
    const isActive = memberCheck.rows[0].is_active
    const familyId = memberCheck.rows[0].family_id
    const familyIsActive = memberCheck.rows[0].family_is_active
    
    // Only update if not archived
    if (currentStatus === 'archived') return
    
    // Check if any family member is active
    let anyFamilyActive = familyIsActive
    if (familyId) {
      const familyCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM member 
        WHERE family_id = $1 AND is_active = TRUE AND id != $2
      `, [familyId, memberId])
      anyFamilyActive = parseInt(familyCheck.rows[0].count) > 0 || familyIsActive
    }
    
    // Determine new status:
    // - 'enrolled' if has enrollments and member is active
    // - 'family_active' if family is active (even if member isn't enrolled)
    // - 'legacy' otherwise (was 'stand-bye')
    let newStatus = 'legacy'
    if (hasEnrollments && isActive) {
      newStatus = 'enrolled'
    } else if (anyFamilyActive && familyId) {
      newStatus = 'family_active'
    }
    
    await pool.query(`
      UPDATE member 
      SET status = $1, 
          family_is_active = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newStatus, anyFamilyActive, memberId])
  } catch (error) {
    console.error('Error updating member status:', error)
  }
}

// Update member (admin endpoint) - renamed from athletes to members
app.put('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = athleteUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Build update query dynamically
    const updates = []
    const params = []
    let paramCount = 0
    
    if (value.firstName !== undefined) {
      paramCount++
      updates.push(`first_name = $${paramCount}`)
      params.push(value.firstName)
    }
    if (value.lastName !== undefined) {
      paramCount++
      updates.push(`last_name = $${paramCount}`)
      params.push(value.lastName)
    }
    if (value.dateOfBirth !== undefined) {
      paramCount++
      updates.push(`date_of_birth = $${paramCount}`)
      params.push(value.dateOfBirth)
    }
    if (value.medicalNotes !== undefined) {
      paramCount++
      updates.push(`medical_notes = $${paramCount}`)
      params.push(value.medicalNotes || null)
    }
    if (value.internalFlags !== undefined) {
      paramCount++
      updates.push(`internal_flags = $${paramCount}`)
      params.push(value.internalFlags || null)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }
    
    updates.push(`updated_at = now()`)
    paramCount++
    params.push(id)
    
    await pool.query(`
      UPDATE member 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `, params)
    
    // Update member status based on enrollments
    await updateMemberStatus(parseInt(id))
    
    // Re-fetch member with updated status
    const updatedMemberResult = await pool.query(`
      SELECT m.*, EXTRACT(YEAR FROM AGE(m.date_of_birth)) as age
      FROM member m
      WHERE m.id = $1
    `, [id])
    
    if (updatedMemberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const updatedMember = updatedMemberResult.rows[0]
    updatedMember.age = updatedMember.date_of_birth ? parseInt(updatedMember.age) : null
    
    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updatedMember
    })
  } catch (error) {
    console.error('Update member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Remove member from family (admin endpoint)
// If adult: creates their own family
// If minor: sets family_id to NULL (orphan status - to be handled later)
app.delete('/api/admin/families/:familyId/members/:memberId', async (req, res) => {
  try {
    const { familyId, memberId } = req.params
    
    // Get facility
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }
    const facilityId = facilityResult.rows[0].id
    
    // Get member info
    const memberCheck = await pool.query(`
      SELECT m.*, EXTRACT(YEAR FROM AGE(m.date_of_birth)) as age
      FROM member m
      WHERE m.id = $1 AND m.facility_id = $2
    `, [memberId, facilityId])
    
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const member = memberCheck.rows[0]
    const age = member.date_of_birth ? parseInt(member.age) : null
    const isAdult = age !== null && age >= 18
    
    // Verify family exists
    const familyCheck = await pool.query(`
      SELECT id FROM family WHERE id = $1 AND facility_id = $2
    `, [familyId, facilityId])
    
    if (familyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    // Check if removing this member will leave children without guardians
    // Get all children in the family (members under 18)
    const childrenInFamily = await pool.query(`
      SELECT m.id, m.first_name, m.last_name, EXTRACT(YEAR FROM AGE(m.date_of_birth)) as age
      FROM member m
      WHERE m.family_id = $1 AND m.id != $2 AND m.date_of_birth IS NOT NULL
    `, [familyId, memberId])
    
    // Check remaining guardians after removal
    const remainingGuardians = await pool.query(`
      SELECT COUNT(*) as count
      FROM family_guardian fg
      WHERE fg.family_id = $1 AND (fg.user_id != $2 OR fg.member_id != $2)
    `, [familyId, member.id])
    
    const guardianCount = parseInt(remainingGuardians.rows[0].count || '0')
    const primaryUserCheck = await pool.query(`
      SELECT primary_user_id, primary_member_id FROM family WHERE id = $1
    `, [familyId])
    const currentPrimaryUserId = primaryUserCheck.rows.length > 0 ? primaryUserCheck.rows[0].primary_user_id : null
    const currentPrimaryMemberId = primaryUserCheck.rows.length > 0 ? primaryUserCheck.rows[0].primary_member_id : null
    const willBecomePrimary = currentPrimaryUserId === member.id || currentPrimaryMemberId === member.id
    const hasOtherPrimaryGuardian = (currentPrimaryUserId !== null && currentPrimaryUserId !== member.id) || 
                                    (currentPrimaryMemberId !== null && currentPrimaryMemberId !== member.id)
    
    // Check if any remaining children will be left without guardians
    const willLeaveChildrenOrphaned = childrenInFamily.rows.some(child => {
      const childAge = parseInt(child.age)
      return childAge < 18 && guardianCount === 0 && !hasOtherPrimaryGuardian
    })
    
    // If adult: create their own family
    if (isAdult && member.id) {
      // Remove from current family guardians
      await pool.query(`
        DELETE FROM family_guardian WHERE family_id = $1 AND (user_id = $2 OR member_id = $2)
      `, [familyId, member.id])
      
      // Update family primary_user_id/primary_member_id if this was the primary
      if (willBecomePrimary) {
        await pool.query(`
          UPDATE family 
          SET primary_user_id = CASE WHEN primary_user_id = $1 THEN NULL ELSE primary_user_id END,
              primary_member_id = CASE WHEN primary_member_id = $1 THEN NULL ELSE primary_member_id END
          WHERE id = $2
        `, [member.id, familyId])
      }
      
      // Create new family for the adult
      const newFamilyResult = await pool.query(`
        INSERT INTO family (facility_id, primary_member_id, family_name)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [facilityId, member.id, `${member.first_name} ${member.last_name} Family`])
      
      const newFamilyId = newFamilyResult.rows[0].id
      
      // Add as guardian to new family
      await pool.query(`
        INSERT INTO family_guardian (family_id, member_id, is_primary)
        VALUES ($1, $2, TRUE)
      `, [newFamilyId, member.id])
      
      // Update member to new family
      await pool.query(`
        UPDATE member SET family_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [newFamilyId, memberId])
      
      // If removing this adult leaves children without guardians, orphan those children
      if (willLeaveChildrenOrphaned) {
        for (const child of childrenInFamily.rows) {
          const childAge = child.date_of_birth ? parseInt(child.age) : null
          if (childAge !== null && childAge < 18) {
            await pool.query(`
              UPDATE member SET family_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [child.id])
          }
        }
      }
      
      res.json({
        success: true,
        message: willLeaveChildrenOrphaned 
          ? 'Member removed from family and placed in their own family. Children in the family have been orphaned.'
          : 'Member removed from family and placed in their own family',
        data: {
          newFamilyId,
          memberId: memberId,
          orphanedChildren: willLeaveChildrenOrphaned ? childrenInFamily.rows.filter(c => c.date_of_birth && parseInt(c.age) < 18).map(c => c.id) : []
        }
      })
    } else {
      // If minor: set family_id to NULL (orphan status)
      // Only children without an assigned family are designated as orphaned
      await pool.query(`
        UPDATE member SET family_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [memberId])
      
      res.json({
        success: true,
        message: 'Child removed from family (orphan status)',
        data: {
          memberId: memberId,
          isOrphan: true
        }
      })
    }
  } catch (error) {
    console.error('Remove member from family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete member (admin endpoint) - renamed from athletes to members
app.delete('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM member WHERE id = $1', [id])
    
    res.json({
      success: true,
      message: 'Member deleted successfully'
    })
  } catch (error) {
    console.error('Delete member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create emergency contact (admin endpoint)
app.post('/api/admin/emergency-contacts', async (req, res) => {
  try {
    const { error, value } = emergencyContactSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Verify member exists
    const memberCheck = await pool.query('SELECT id FROM member WHERE id = $1', [value.memberId])
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const result = await pool.query(`
      INSERT INTO emergency_contact (member_id, name, relationship, phone, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      value.memberId,
      value.name,
      value.relationship || null,
      value.phone,
      value.email || null
    ])
    
    res.json({
      success: true,
      message: 'Emergency contact created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Create emergency contact error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete emergency contact (admin endpoint)
app.delete('/api/admin/emergency-contacts/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM emergency_contact WHERE id = $1', [id])
    
    res.json({
      success: true,
      message: 'Emergency contact deleted successfully'
    })
  } catch (error) {
    console.error('Delete emergency contact error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Member login - supports email or username
app.post('/api/members/login', async (req, res) => {
  try {
    const { error, value } = memberLoginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Get facility (optional - allow null if not found)
    let facilityId = null
    try {
      const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
      if (facilityResult.rows.length > 0) {
        facilityId = facilityResult.rows[0].id
      }
    } catch (facilityError) {
      // If facility table doesn't exist or query fails, allow null facility_id
      console.log('Facility query failed, allowing null facility_id:', facilityError.message)
      facilityId = null
    }

    // Find user by email OR username (for PARENT_GUARDIAN or ATHLETE roles)
    // Check both app_user.role and user_role table for role matching
    const emailOrUsername = value.emailOrUsername.trim()
    const isEmail = emailOrUsername.includes('@')
    
    let query, params
    if (isEmail) {
      if (facilityId !== null) {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          WHERE (u.facility_id = $1 OR u.facility_id IS NULL)
            AND u.email = $2 
            AND (u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
                 OR ur.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE'))
            AND u.is_active = TRUE
        `
        params = [facilityId, emailOrUsername]
      } else {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          WHERE u.email = $1 
            AND (u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
                 OR ur.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE'))
            AND u.is_active = TRUE
        `
        params = [emailOrUsername]
      }
    } else {
      // Username comparison - case insensitive, handle NULL usernames
      const usernameLower = emailOrUsername.toLowerCase()
      if (facilityId !== null) {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          WHERE (u.facility_id = $1 OR u.facility_id IS NULL)
            AND u.username IS NOT NULL
            AND LOWER(u.username) = $2 
            AND (u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
                 OR ur.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE'))
            AND u.is_active = TRUE
        `
        params = [facilityId, usernameLower]
      } else {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN user_role ur ON ur.user_id = u.id
          WHERE u.username IS NOT NULL
            AND LOWER(u.username) = $1 
            AND (u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
                 OR ur.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE'))
            AND u.is_active = TRUE
        `
        params = [usernameLower]
      }
    }
    
    let result
    try {
      result = await pool.query(query, params)
    } catch (queryError) {
      console.error('Database query error:', queryError)
      console.error('Query:', query)
      console.error('Params:', params)
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: process.env.NODE_ENV === 'development' ? queryError.message : undefined
      })
    }
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password'
      })
    }

    const user = result.rows[0]

    // Check if password_hash exists
    if (!user.password_hash) {
      console.error('User found but password_hash is missing:', user.id)
      return res.status(500).json({
        success: false,
        message: 'User account configuration error'
      })
    }

    // Verify password
    let isValidPassword = false
    try {
      isValidPassword = await bcrypt.compare(value.password, user.password_hash)
    } catch (bcryptError) {
      console.error('Password comparison error:', bcryptError)
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      })
    }
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password'
      })
    }

    // Get user's family information (optional - allow if family table doesn't exist)
    let familyResult = { rows: [] }
    try {
      familyResult = await pool.query(`
        SELECT f.id, f.family_name, f.primary_user_id
        FROM family f
        WHERE f.primary_user_id = $1 OR EXISTS (
          SELECT 1 FROM family_guardian fg WHERE fg.family_id = f.id AND fg.user_id = $1
        )
        LIMIT 1
      `, [user.id])
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
      // Continue without family data
      familyResult = { rows: [] }
    }

    // Get user's family members if they're a guardian
    let familyMembers = []
    if (user.role === 'PARENT_GUARDIAN' && familyResult.rows.length > 0) {
      try {
        const membersResult = await pool.query(`
          SELECT m.id, m.first_name, m.last_name, m.date_of_birth, m.status
          FROM member m
          WHERE m.family_id = $1 AND m.is_active = TRUE
        `, [familyResult.rows[0].id])
        familyMembers = membersResult.rows
      } catch (memberError) {
        console.log('Member query failed (non-critical):', memberError.message)
        // Continue without member data
        familyMembers = []
      }
    }

    // Get all user roles
    const allUserRoles = await getUserRoles(user.id)

    // Generate JWT token with all roles
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, roles: allUserRoles },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    // Format member data for frontend
    const fullName = user.full_name || ''
    const nameParts = fullName.split(' ')
    const memberData = {
      id: user.id,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || null,
      username: user.username || '',
      role: user.role || '', // Primary role for backward compatibility
      roles: allUserRoles, // All roles
      familyId: familyResult.rows.length > 0 ? familyResult.rows[0].id : null,
      familyName: familyResult.rows.length > 0 ? familyResult.rows[0].family_name : null,
      familyMembers: familyMembers.map(m => ({
        id: m.id,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        dateOfBirth: m.date_of_birth || null,
        status: m.status || 'legacy'
      }))
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      member: memberData
    })
  } catch (error) {
    console.error('Member login error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get current member (protected endpoint)
app.get('/api/members/me', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    
    // Get user from app_user table (check both app_user.role and user_role table)
    const userResult = await pool.query(`
      SELECT DISTINCT u.id, u.email, u.full_name, u.phone, u.role, u.username, u.is_active, u.created_at, u.address
      FROM app_user u
      LEFT JOIN user_role ur ON ur.user_id = u.id
      WHERE u.id = $1 
        AND (u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
             OR ur.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE'))
    `, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }

    const user = userResult.rows[0]

    // Get user's family information (optional - allow if family table doesn't exist)
    let familyResult = { rows: [] }
    try {
      familyResult = await pool.query(`
        SELECT f.id, f.family_name, f.primary_user_id
        FROM family f
        WHERE f.primary_user_id = $1 OR EXISTS (
          SELECT 1 FROM family_guardian fg WHERE fg.family_id = f.id AND fg.user_id = $1
        )
        LIMIT 1
      `, [userId])
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
      // Continue without family data
      familyResult = { rows: [] }
    }

    // Get user's family members if they're a guardian
    let familyMembers = []
    if (user.role === 'PARENT_GUARDIAN' && familyResult.rows.length > 0) {
      try {
        const membersResult = await pool.query(`
          SELECT m.id, m.first_name, m.last_name, m.date_of_birth, m.status
          FROM member m
          WHERE m.family_id = $1 AND m.is_active = TRUE
        `, [familyResult.rows[0].id])
        familyMembers = membersResult.rows
      } catch (memberError) {
        console.log('Member query failed (non-critical):', memberError.message)
        // Continue without member data
        familyMembers = []
      }
    }

    // Format member data for frontend
    const fullName = user.full_name || ''
    const nameParts = fullName.split(' ')
    const memberData = {
      id: user.id,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || null,
      username: user.username || '',
      role: user.role || '', // Primary role for backward compatibility
      roles: allUserRoles, // All roles
      familyId: familyResult.rows.length > 0 ? familyResult.rows[0].id : null,
      familyName: familyResult.rows.length > 0 ? familyResult.rows[0].family_name : null,
      familyMembers: familyMembers.map(m => ({
        id: m.id,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        dateOfBirth: m.date_of_birth || null,
        status: m.status || 'legacy'
      }))
    }

    res.json({
      success: true,
      member: memberData,
      data: memberData
    })
  } catch (error) {
    console.error('Get member error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update current member profile
app.put('/api/members/me', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    const { first_name, last_name, email, phone, address } = req.body

    // Get current user
    const userResult = await pool.query(`
      SELECT u.id, u.full_name
      FROM app_user u
      WHERE u.id = $1 AND u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE')
    `, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }

    // Update user
    const updateFields = []
    const updateValues = []
    let paramCount = 1

    if (first_name !== undefined || last_name !== undefined) {
      const fullName = `${first_name || ''} ${last_name || ''}`.trim()
      if (fullName) {
        updateFields.push(`full_name = $${paramCount++}`)
        updateValues.push(fullName)
      }
    }
    if (email !== undefined && email !== null) {
      updateFields.push(`email = $${paramCount++}`)
      updateValues.push(email)
    }
    if (phone !== undefined && phone !== null) {
      updateFields.push(`phone = $${paramCount++}`)
      updateValues.push(phone)
    }

    if (updateFields.length > 0) {
      updateValues.push(userId)
      // Try to update with updated_at, fallback if column doesn't exist
      try {
        await pool.query(`
          UPDATE app_user
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount}
        `, updateValues)
      } catch (updateError) {
        // If updated_at doesn't exist, try without it
        if (updateError.message && updateError.message.includes('updated_at')) {
          await pool.query(`
            UPDATE app_user
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount}
          `, updateValues)
        } else {
          console.error('Update error:', updateError)
          throw updateError
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    // If address is provided, we might need to store it elsewhere or add to app_user table
    // For now, we'll skip address as it's not in the app_user schema

    res.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Update member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get family members
app.get('/api/members/family', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId

    // Get user's family (optional - allow if family table doesn't exist)
    let familyResult = { rows: [] }
    try {
      familyResult = await pool.query(`
        SELECT f.id, f.family_name, f.primary_user_id
        FROM family f
        WHERE f.primary_user_id = $1 OR EXISTS (
          SELECT 1 FROM family_guardian fg WHERE fg.family_id = f.id AND fg.user_id = $1
        )
        LIMIT 1
      `, [userId])
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
      // Return empty family members if family table doesn't exist
      return res.json({
        success: true,
        familyMembers: []
      })
    }

    if (familyResult.rows.length === 0) {
      return res.json({
        success: true,
        familyMembers: []
      })
    }

    const familyId = familyResult.rows[0].id

    // Get all family members using unified member table
    let guardiansResult = { rows: [] }
    try {
      guardiansResult = await pool.query(`
        SELECT 
          m.id,
          m.first_name || ' ' || m.last_name as full_name,
          m.email,
          m.phone,
          CASE 
            WHEN m.status = 'enrolled' THEN 'ATHLETE'
            WHEN EXISTS (
              SELECT 1 FROM app_user u 
              WHERE u.id = m.id AND u.role IN ('PARENT_GUARDIAN', 'ATHLETE_VIEWER')
            ) THEN (SELECT role FROM app_user WHERE id = m.id)
            ELSE 'MEMBER'
          END as role,
          CASE WHEN f.primary_user_id = m.id OR f.primary_member_id = m.id THEN TRUE ELSE FALSE END as is_primary,
          CASE WHEN m.email IS NOT NULL OR EXISTS (
            SELECT 1 FROM app_user u WHERE u.id = m.id
          ) THEN TRUE ELSE FALSE END as is_adult,
          m.date_of_birth,
          CASE WHEN m.date_of_birth IS NOT NULL 
            THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
            ELSE NULL 
          END as age,
          m.id as user_id,
          FALSE as marked_for_removal
        FROM member m
        LEFT JOIN family f ON f.primary_user_id = m.id OR f.primary_member_id = m.id
        LEFT JOIN family_guardian fg ON fg.member_id = m.id OR fg.user_id = m.id
        WHERE m.family_id = $1 AND m.is_active = TRUE
      `, [familyId])
    } catch (queryError) {
      console.log('Family members query failed (non-critical):', queryError.message)
      // Return empty family members if query fails
      return res.json({
        success: true,
        familyMembers: []
      })
    }

    const familyMembers = guardiansResult.rows.map(row => ({
      id: row.id,
      first_name: row.full_name?.split(' ')[0] || '',
      last_name: row.full_name?.split(' ').slice(1).join(' ') || '',
      email: row.email,
      phone: row.phone,
      date_of_birth: row.date_of_birth,
      age: row.age,
      user_id: row.user_id,
      is_adult: row.is_adult || row.role === 'PARENT_GUARDIAN',
      marked_for_removal: row.marked_for_removal || false
    }))

    res.json({
      success: true,
      familyMembers
    })
  } catch (error) {
    console.error('Get family members error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update family member
app.put('/api/members/family/:id', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    const familyMemberId = parseInt(req.params.id)
    const { first_name, last_name, email, phone } = req.body

    // Check if user is an adult (has PARENT_GUARDIAN role)
    const hasParentRole = await userHasRole(userId, 'PARENT_GUARDIAN')
    
    if (!hasParentRole) {
      return res.status(403).json({
        success: false,
        message: 'Only adults can edit family member information'
      })
    }

    // Check if family member exists and belongs to user's family
    const familyResult = await pool.query(`
      SELECT f.id as family_id
      FROM family f
      WHERE f.primary_user_id = $1 OR EXISTS (
        SELECT 1 FROM family_guardian fg WHERE fg.family_id = f.id AND fg.user_id = $1
      )
      LIMIT 1
    `, [userId])

    if (familyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }

    const familyId = familyResult.rows[0].family_id

    // Check if it's a member
    const memberCheck = await pool.query(`
      SELECT m.id
      FROM member m
      WHERE m.id = $1 AND m.family_id = $2
    `, [familyMemberId, familyId])

    if (memberCheck.rows.length > 0) {
      // Update member
      const updateFields = []
      const updateValues = []
      let paramCount = 1

      if (first_name !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`)
        updateValues.push(first_name)
      }
      if (last_name !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`)
        updateValues.push(last_name)
      }
      if (email !== undefined) {
        updateFields.push(`email = $${paramCount++}`)
        updateValues.push(email)
      }
      if (phone !== undefined) {
        updateFields.push(`phone = $${paramCount++}`)
        updateValues.push(phone)
      }

      if (updateFields.length > 0) {
        updateValues.push(familyMemberId)
        await pool.query(`
          UPDATE member
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount}
        `, updateValues)
      }
    } else {
      // Update user (guardian)
      const userUpdateFields = []
      const userUpdateValues = []
      let userParamCount = 1

      if (first_name !== undefined || last_name !== undefined) {
        const fullName = `${first_name || ''} ${last_name || ''}`.trim()
        userUpdateFields.push(`full_name = $${userParamCount++}`)
        userUpdateValues.push(fullName)
      }
      if (email !== undefined) {
        userUpdateFields.push(`email = $${userParamCount++}`)
        userUpdateValues.push(email)
      }
      if (phone !== undefined) {
        userUpdateFields.push(`phone = $${userParamCount++}`)
        userUpdateValues.push(phone)
      }

      if (userUpdateFields.length > 0) {
        userUpdateValues.push(familyMemberId)
        await pool.query(`
          UPDATE app_user
          SET ${userUpdateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${userParamCount}
        `, userUpdateValues)
      }
    }

    res.json({
      success: true,
      message: 'Family member updated successfully'
    })
  } catch (error) {
    console.error('Update family member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Mark family member for removal
app.post('/api/members/family/:id/mark-for-removal', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    const familyMemberId = parseInt(req.params.id)

    // Check if user is an adult
    const userResult = await pool.query(`
      SELECT u.role
      FROM app_user u
      WHERE u.id = $1
    `, [userId])

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'PARENT_GUARDIAN') {
      return res.status(403).json({
        success: false,
        message: 'Only adults can mark family members for removal'
      })
    }

    // Check if it's a member
    const memberCheck = await pool.query(`
      SELECT m.id, m.family_id
      FROM member m
      WHERE m.id = $1
    `, [familyMemberId])

    if (memberCheck.rows.length > 0) {
      // Add internal flag for removal request
      await pool.query(`
        UPDATE member
        SET internal_flags = COALESCE(internal_flags, '') || 'MARKED_FOR_REMOVAL;',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [familyMemberId])
    } else {
      // For users, we could add a note or flag
      // This is a placeholder - you may want to implement a proper removal request system
      await pool.query(`
        UPDATE app_user
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [familyMemberId])
    }

    res.json({
      success: true,
      message: 'Family member marked for removal. Administrator will be notified.'
    })
  } catch (error) {
    console.error('Mark for removal error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Enroll in class
const workerId = process.env.RENDER_SERVICE_ID || process.pid || 'unknown'
console.log(`[Server Init ${workerId}] Registering POST /api/members/enroll endpoint`)
app.post('/api/members/enroll', authenticateMember, async (req, res) => {
  console.log(`[Enroll ${workerId}] Enrollment request received on worker ${workerId}`)
  console.log('[Enroll] Enrollment request received:', { 
    userId: req.userId, 
    isAdmin: req.isAdmin,
    body: req.body 
  })
  try {
    const userId = req.userId || req.memberId
    const { programId, familyMemberId, iterationId, daysPerWeek, selectedDays } = req.body

    if (!programId || !familyMemberId || !iterationId || !daysPerWeek) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: programId, familyMemberId, iterationId, daysPerWeek'
      })
    }

    if (!selectedDays || !Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one day of the week'
      })
    }

    if (selectedDays.length !== daysPerWeek) {
      return res.status(400).json({
        success: false,
        message: `Number of selected days (${selectedDays.length}) must match days per week (${daysPerWeek})`
      })
    }
    
    // Validate that iteration belongs to program
    const iterationCheck = await pool.query(`
      SELECT id, program_id, days_of_week, start_time, end_time
      FROM class_iteration
      WHERE id = $1 AND program_id = $2
    `, [iterationId, programId])
    
    if (iterationCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid iteration for this program'
      })
    }
    
    const iteration = iterationCheck.rows[0]
    const iterationDays = iteration.days_of_week || []
    
    // Validate that selected days are within iteration's available days
    const dayNameToNumber = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0
    }
    const selectedDayNumbers = selectedDays.map((day) => dayNameToNumber[day]).filter((num) => num !== undefined)
    
    const invalidDays = selectedDayNumbers.filter((dayNum) => !iterationDays.includes(dayNum))
    if (invalidDays.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return res.status(400).json({
        success: false,
        message: `Selected days must be within the iteration's available days: ${iterationDays.map((d) => dayNames[d]).join(', ')}`
      })
    }

    // Get the member - familyMemberId should be a member ID
    const memberCheck = await pool.query(`
      SELECT m.id, m.first_name, m.last_name, m.family_id, m.email, m.status, m.is_active
      FROM member m
      WHERE m.id = $1 AND m.is_active = TRUE
    `, [familyMemberId])
    
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family member not found or inactive'
      })
    }
    
    const member = memberCheck.rows[0]

    // Check permissions - admins can enroll anyone, others can only enroll their own family members
    if (!req.isAdmin) {
      // Check if user is a parent/guardian of this member's family
      const userResult = await pool.query(`
        SELECT u.id, u.role
        FROM app_user u
        WHERE u.id = $1 AND u.is_active = TRUE
      `, [userId])

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }

      const userRole = userResult.rows[0].role
      const isParentGuardian = userRole === 'PARENT_GUARDIAN'
      
      // Check if user is part of the member's family
      let isFamilyMember = false
      if (member.family_id) {
        const familyCheck = await pool.query(`
          SELECT 1
          FROM family f
          WHERE f.id = $1 AND (
            f.primary_user_id = $2 
            OR EXISTS (
              SELECT 1 FROM family_guardian fg 
              WHERE fg.family_id = f.id AND fg.user_id = $2
            )
          )
        `, [member.family_id, userId])
        
        isFamilyMember = familyCheck.rows.length > 0
      }
      
      if (!isParentGuardian && !isFamilyMember) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to enroll this family member'
        })
      }
    }

    // Check if program exists
    let programCheck
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'program' AND column_name = 'archived'
      `)
      const hasArchivedColumn = columnCheck.rows.length > 0
      
      if (hasArchivedColumn) {
        programCheck = await pool.query(`
          SELECT id, name, display_name
          FROM program
          WHERE id = $1 AND archived = FALSE AND is_active = TRUE
        `, [programId])
      } else {
        programCheck = await pool.query(`
          SELECT id, name, display_name
          FROM program
          WHERE id = $1 AND is_active = TRUE
        `, [programId])
      }
    } catch (queryError) {
      console.error('Error checking program:', queryError)
      throw queryError
    }

    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found or not available'
      })
    }

    // Create enrollment record in member_program table
    try {
      const selectedDaysJson = JSON.stringify(selectedDays)
      
      // Insert enrollment record - member_program table already exists (created in initDatabase)
      await pool.query(`
        INSERT INTO member_program (member_id, program_id, iteration_id, days_per_week, selected_days, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (member_id, program_id, iteration_id) DO UPDATE
        SET days_per_week = $4, selected_days = $5::jsonb, updated_at = CURRENT_TIMESTAMP
      `, [member.id, programId, iterationId, daysPerWeek, selectedDaysJson])
    } catch (error) {
      console.error('Error creating enrollment record:', error)
      console.error('Error stack:', error.stack)
      return res.status(500).json({
        success: false,
        message: 'Failed to create enrollment record: ' + (error.message || 'Unknown error'),
        error: process.env.NODE_ENV !== 'production' ? error.message : undefined
      })
    }

    // Update member status to 'enrolled' if not already
    if (member.status !== 'enrolled') {
      await pool.query(`
        UPDATE member
        SET status = 'enrolled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [member.id])
    }

    res.json({
      success: true,
      message: `${member.first_name} ${member.last_name} has been enrolled in ${programCheck.rows[0].display_name}`
    })
  } catch (error) {
    console.error('Enroll error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + (error.message || 'Unknown error'),
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    })
  }
})

// Unenroll from program (member endpoint)
app.delete('/api/members/enroll/:enrollmentId', authenticateMember, async (req, res) => {
  try {
    const { enrollmentId } = req.params
    const userId = req.userId || req.memberId
    
    // Get enrollment info - use member_program instead of athlete_program
    const enrollmentCheck = await pool.query(`
      SELECT mp.*, m.id as member_id, m.first_name, m.last_name, m.family_id, m.status
      FROM member_program mp
      JOIN member m ON mp.member_id = m.id
      WHERE mp.id = $1
    `, [enrollmentId])
    
    if (enrollmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      })
    }
    
    const enrollment = enrollmentCheck.rows[0]
    const memberId = enrollment.member_id
    
    // Check permission (must be parent/guardian or the member themselves)
    if (!req.isAdmin) {
      const hasParentRole = await userHasRole(userId, 'PARENT_GUARDIAN')
      
      // Check if user is part of the member's family
      let isFamilyMember = false
      if (enrollment.family_id) {
        const familyCheck = await pool.query(`
          SELECT 1
          FROM family f
          WHERE f.id = $1 AND (
            f.primary_user_id = $2 
            OR EXISTS (
              SELECT 1 FROM family_guardian fg 
              WHERE fg.family_id = f.id AND fg.user_id = $2
            )
          )
        `, [enrollment.family_id, userId])
        
        isFamilyMember = familyCheck.rows.length > 0
      }
      
      if (!hasParentRole && !isFamilyMember) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to unenroll this member'
        })
      }
    }
    
    // Delete enrollment
    await pool.query('DELETE FROM member_program WHERE id = $1', [enrollmentId])
    
    // Update member status - check if they have any remaining enrollments
    const remainingEnrollments = await pool.query(`
      SELECT COUNT(*) as count
      FROM member_program
      WHERE member_id = $1
    `, [memberId])
    
    if (remainingEnrollments.rows[0].count === '0') {
      // No more enrollments, update status to 'legacy' or 'family_active'
      await pool.query(`
        UPDATE member
        SET status = CASE 
          WHEN family_is_active = TRUE THEN 'family_active'
          ELSE 'legacy'
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [memberId])
    }
    
    res.json({
      success: true,
      message: `${enrollment.first_name} ${enrollment.last_name} has been unenrolled`
    })
  } catch (error) {
    console.error('Unenroll error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get family enrollments
app.get('/api/members/enrollments', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId

    // Get user's family
    let familyResult = { rows: [] }
    try {
      familyResult = await pool.query(`
        SELECT f.id, f.family_name, f.primary_user_id
        FROM family f
        WHERE f.primary_user_id = $1 OR EXISTS (
          SELECT 1 FROM family_guardian fg WHERE fg.family_id = f.id AND fg.user_id = $1
        )
        LIMIT 1
      `, [userId])
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
      return res.json({
        success: true,
        enrollments: []
      })
    }

    if (familyResult.rows.length === 0) {
      return res.json({
        success: true,
        enrollments: []
      })
    }

    const familyId = familyResult.rows[0].id

    // Get all members in the family
    let members = []
    try {
      const membersResult = await pool.query(`
        SELECT m.id, m.first_name, m.last_name, m.status, m.is_active
        FROM member m
        WHERE m.family_id = $1 AND m.is_active = TRUE
      `, [familyId])
      members = membersResult.rows
    } catch (memberError) {
      console.log('Member query failed (non-critical):', memberError.message)
      return res.json({
        success: true,
        enrollments: []
      })
    }

    if (members.length === 0) {
      return res.json({
        success: true,
        enrollments: []
      })
    }

    const memberIds = members.map(m => m.id)

    // Get enrollments for all family members using member_program
    try {
      const enrollmentsResult = await pool.query(`
        SELECT 
          mp.id,
          mp.member_id,
          mp.program_id,
          mp.iteration_id,
          mp.days_per_week,
          mp.selected_days,
          mp.created_at,
          mp.updated_at,
          m.first_name as member_first_name,
          m.last_name as member_last_name,
          m.status as member_status,
          p.display_name as program_display_name,
          p.name as program_name
        FROM member_program mp
        JOIN member m ON mp.member_id = m.id
        LEFT JOIN program p ON mp.program_id = p.id
        WHERE mp.member_id = ANY($1::bigint[])
        ORDER BY mp.created_at DESC
      `, [memberIds])

      const enrollments = enrollmentsResult.rows.map(row => ({
        id: row.id,
        member_id: row.member_id,
        member_first_name: row.member_first_name,
        member_last_name: row.member_last_name,
        member_status: row.member_status,
        program_id: row.program_id,
        iteration_id: row.iteration_id,
        program_display_name: row.program_display_name,
        program_name: row.program_name,
        days_per_week: row.days_per_week,
        selected_days: row.selected_days ? (typeof row.selected_days === 'string' ? JSON.parse(row.selected_days) : row.selected_days) : null,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))

      res.json({
        success: true,
        enrollments
      })
    } catch (enrollmentError) {
      console.log('Enrollment query failed (non-critical):', enrollmentError.message)
      // If table doesn't exist, return empty array
      res.json({
        success: true,
        enrollments: []
      })
    }
  } catch (error) {
    console.error('Get enrollments error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// ========== EVENT ENDPOINTS ==========

// Get all events (public endpoint for ReadBoard)
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        event_name as "eventName",
        short_description as "shortDescription",
        long_description as "longDescription",
        start_date as "startDate",
        end_date as "endDate",
        type,
        address,
        dates_and_times as "datesAndTimes",
        key_details as "keyDetails",
        images,
        tag_type as "tagType",
        tag_class_ids as "tagClassIds",
        tag_category_ids as "tagCategoryIds",
        tag_all_parents as "tagAllParents",
        tag_boosters as "tagBoosters",
        tag_volunteers as "tagVolunteers",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM events
      WHERE archived = FALSE OR archived IS NULL
      ORDER BY start_date ASC, created_at DESC
    `)

    // Convert date strings to Date objects and parse JSON fields
    const events = result.rows.map(event => {
      // Parse JSONB fields (PostgreSQL returns them as JSON strings)
      let datesAndTimes = []
      let keyDetails = []
      let images = []
      
      try {
        datesAndTimes = typeof event.datesAndTimes === 'string' 
          ? JSON.parse(event.datesAndTimes) 
          : (event.datesAndTimes || [])
        keyDetails = typeof event.keyDetails === 'string'
          ? JSON.parse(event.keyDetails)
          : (event.keyDetails || [])
        images = typeof event.images === 'string'
          ? JSON.parse(event.images)
          : (event.images || [])
      } catch (e) {
        console.error('Error parsing JSON fields:', e)
      }
      
      // Parse dates in local timezone to avoid timezone shift
      const parseLocalDate = (dateStr) => {
        if (!dateStr) return undefined
        if (dateStr instanceof Date) return dateStr
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      
      return {
        ...event,
        startDate: parseLocalDate(event.startDate),
        endDate: event.endDate ? parseLocalDate(event.endDate) : undefined,
        datesAndTimes: Array.isArray(datesAndTimes) 
          ? datesAndTimes.map(dt => ({
              ...dt,
              date: parseLocalDate(dt.date)
            }))
          : [],
        keyDetails: Array.isArray(keyDetails) ? keyDetails : [],
        images: Array.isArray(images) ? images : [],
        tagType: event.tagType || 'all_classes_and_parents',
        tagClassIds: event.tagClassIds || null,
        tagCategoryIds: event.tagCategoryIds || null,
        tagAllParents: event.tagAllParents || false,
        tagBoosters: event.tagBoosters || false,
        tagVolunteers: event.tagVolunteers || false
      }
    })

    res.json({
      success: true,
      events: events,
      data: events
    })
  } catch (error) {
    console.error('Get events error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/Unarchive event (admin endpoint)
app.patch('/api/admin/events/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body

    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }

    const result = await pool.query(`
      UPDATE events 
      SET archived = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING 
        id,
        event_name as "eventName",
        archived
    `, [archived, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      })
    }

    res.json({
      success: true,
      message: archived ? 'Event archived successfully' : 'Event unarchived successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Archive event error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get all events (admin endpoint)
app.get('/api/admin/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        event_name as "eventName",
        short_description as "shortDescription",
        long_description as "longDescription",
        start_date as "startDate",
        end_date as "endDate",
        type,
        address,
        dates_and_times as "datesAndTimes",
        key_details as "keyDetails",
        images,
        tag_type as "tagType",
        tag_class_ids as "tagClassIds",
        tag_category_ids as "tagCategoryIds",
        tag_all_parents as "tagAllParents",
        tag_boosters as "tagBoosters",
        tag_volunteers as "tagVolunteers",
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM events
      ORDER BY archived ASC, start_date ASC, created_at DESC
    `)

    // Convert date strings to Date objects and parse JSON fields
    const events = result.rows.map(event => {
      // Parse JSONB fields (PostgreSQL returns them as JSON strings)
      let datesAndTimes = []
      let keyDetails = []
      let images = []
      
      try {
        datesAndTimes = typeof event.datesAndTimes === 'string' 
          ? JSON.parse(event.datesAndTimes) 
          : (event.datesAndTimes || [])
        keyDetails = typeof event.keyDetails === 'string'
          ? JSON.parse(event.keyDetails)
          : (event.keyDetails || [])
        images = typeof event.images === 'string'
          ? JSON.parse(event.images)
          : (event.images || [])
      } catch (e) {
        console.error('Error parsing JSON fields:', e)
      }
      
      // Parse dates in local timezone to avoid timezone shift
      const parseLocalDate = (dateStr) => {
        if (!dateStr) return undefined
        // If it's already a Date object, return it
        if (dateStr instanceof Date) return dateStr
        // Parse date string (YYYY-MM-DD) in local timezone
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      
      return {
        ...event,
        archived: event.archived || false,
        startDate: parseLocalDate(event.startDate),
        endDate: event.endDate ? parseLocalDate(event.endDate) : undefined,
        datesAndTimes: Array.isArray(datesAndTimes) 
          ? datesAndTimes.map(dt => ({
              ...dt,
              date: parseLocalDate(dt.date)
            }))
          : [],
        keyDetails: Array.isArray(keyDetails) ? keyDetails : [],
        images: Array.isArray(images) ? images : [],
        tagType: event.tagType || 'all_classes_and_parents',
        tagClassIds: event.tagClassIds || null,
        tagCategoryIds: event.tagCategoryIds || null,
        tagAllParents: event.tagAllParents || false,
        tagBoosters: event.tagBoosters || false,
        tagVolunteers: event.tagVolunteers || false
      }
    })

    res.json({
      success: true,
      data: events
    })
  } catch (error) {
    console.error('Get events error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create event (admin endpoint)
app.post('/api/admin/events', async (req, res) => {
  try {
    const { error, value } = eventSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const result = await pool.query(`
      INSERT INTO events 
      (event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details, images,
       tag_type, tag_class_ids, tag_category_ids, tag_all_parents, tag_boosters, tag_volunteers)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING 
        id,
        event_name as "eventName",
        short_description as "shortDescription",
        long_description as "longDescription",
        start_date as "startDate",
        end_date as "endDate",
        type,
        address,
        dates_and_times as "datesAndTimes",
        key_details as "keyDetails",
        images,
        tag_type as "tagType",
        tag_class_ids as "tagClassIds",
        tag_category_ids as "tagCategoryIds",
        tag_all_parents as "tagAllParents",
        tag_boosters as "tagBoosters",
        tag_volunteers as "tagVolunteers"
    `, [
      value.eventName,
      value.shortDescription,
      value.longDescription,
      value.startDate,
      value.endDate || null,
      value.type || 'event',
      value.address || null,
      JSON.stringify(value.datesAndTimes || []),
      JSON.stringify(value.keyDetails || []),
      JSON.stringify(value.images || []),
      value.tagType || 'all_classes_and_parents',
      value.tagClassIds && value.tagClassIds.length > 0 ? value.tagClassIds : null,
      value.tagCategoryIds && value.tagCategoryIds.length > 0 ? value.tagCategoryIds : null,
      value.tagAllParents || false,
      value.tagBoosters || false,
      value.tagVolunteers || false
    ])

    const event = result.rows[0]
    
    // Parse JSONB fields
    let datesAndTimes = []
    let keyDetails = []
    let images = []
    
    try {
      datesAndTimes = typeof event.datesAndTimes === 'string' 
        ? JSON.parse(event.datesAndTimes) 
        : (event.datesAndTimes || [])
      keyDetails = typeof event.keyDetails === 'string'
        ? JSON.parse(event.keyDetails)
        : (event.keyDetails || [])
      images = typeof event.images === 'string'
        ? JSON.parse(event.images)
        : (event.images || [])
    } catch (e) {
      console.error('Error parsing JSON fields:', e)
    }
    
    // Parse dates in local timezone to avoid timezone shift
    const parseLocalDate = (dateStr) => {
      if (!dateStr) return undefined
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    
    event.startDate = parseLocalDate(event.startDate)
    event.endDate = event.endDate ? parseLocalDate(event.endDate) : undefined
    event.datesAndTimes = Array.isArray(datesAndTimes) 
      ? datesAndTimes.map(dt => ({
          ...dt,
          date: parseLocalDate(dt.date)
        }))
      : []
    event.keyDetails = Array.isArray(keyDetails) ? keyDetails : []
    event.images = Array.isArray(images) ? images : []

    res.json({
      success: true,
      message: 'Event created successfully',
      data: event
    })
  } catch (error) {
    console.error('Create event error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update event (admin endpoint)
app.put('/api/admin/events/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = eventSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Get the current event to compare changes
    const currentEventResult = await pool.query(`
      SELECT 
        event_name,
        short_description,
        long_description,
        start_date,
        end_date,
        type,
        address,
        dates_and_times,
        key_details,
        images
      FROM events
      WHERE id = $1
    `, [id])

    if (currentEventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      })
    }

    const currentEvent = currentEventResult.rows[0]
    
    // Track changes
    const changes = {}
    const formatValue = (val) => {
      if (val === null || val === undefined) return null
      if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        return JSON.stringify(val)
      }
      if (val instanceof Date) {
        return val.toISOString().split('T')[0]
      }
      return String(val)
    }

    // Normalize dates for comparison
    const normalizeDate = (dateVal) => {
      if (!dateVal) return null
      if (dateVal instanceof Date) {
        return dateVal.toISOString().split('T')[0]
      }
      if (typeof dateVal === 'string') {
        // Handle ISO date strings
        return dateVal.split('T')[0]
      }
      return String(dateVal)
    }

    if (formatValue(currentEvent.event_name) !== formatValue(value.eventName)) {
      changes.eventName = { old: currentEvent.event_name, new: value.eventName }
    }
    if (formatValue(currentEvent.short_description) !== formatValue(value.shortDescription)) {
      changes.shortDescription = { old: currentEvent.short_description, new: value.shortDescription }
    }
    if (formatValue(currentEvent.long_description) !== formatValue(value.longDescription)) {
      changes.longDescription = { old: currentEvent.long_description, new: value.longDescription }
    }
    if (normalizeDate(currentEvent.start_date) !== normalizeDate(value.startDate)) {
      changes.startDate = { old: currentEvent.start_date, new: value.startDate }
    }
    if (normalizeDate(currentEvent.end_date) !== normalizeDate(value.endDate)) {
      changes.endDate = { old: currentEvent.end_date, new: value.endDate }
    }
    if (formatValue(currentEvent.type) !== formatValue(value.type)) {
      changes.type = { old: currentEvent.type, new: value.type }
    }
    if (formatValue(currentEvent.address) !== formatValue(value.address)) {
      changes.address = { old: currentEvent.address, new: value.address }
    }
    
    const currentDatesAndTimes = typeof currentEvent.dates_and_times === 'string' 
      ? JSON.parse(currentEvent.dates_and_times) 
      : (currentEvent.dates_and_times || [])
    const newDatesAndTimes = value.datesAndTimes || []
    // Normalize dates in arrays for comparison
    const normalizeDatesAndTimes = (arr) => {
      return arr.map(item => ({
        ...item,
        date: item.date ? normalizeDate(item.date) : null
      }))
    }
    if (JSON.stringify(normalizeDatesAndTimes(currentDatesAndTimes)) !== JSON.stringify(normalizeDatesAndTimes(newDatesAndTimes))) {
      changes.datesAndTimes = { old: currentDatesAndTimes, new: newDatesAndTimes }
    }
    
    const currentKeyDetails = typeof currentEvent.key_details === 'string'
      ? JSON.parse(currentEvent.key_details)
      : (currentEvent.key_details || [])
    if (JSON.stringify(currentKeyDetails) !== JSON.stringify(value.keyDetails || [])) {
      changes.keyDetails = { old: currentKeyDetails, new: value.keyDetails || [] }
    }
    
    const currentImages = typeof currentEvent.images === 'string'
      ? JSON.parse(currentEvent.images)
      : (currentEvent.images || [])
    if (JSON.stringify(currentImages) !== JSON.stringify(value.images || [])) {
      changes.images = { old: currentImages, new: value.images || [] }
    }

    // Update the event
    const result = await pool.query(`
      UPDATE events 
      SET event_name = $1, 
          short_description = $2, 
          long_description = $3, 
          start_date = $4, 
          end_date = $5, 
          type = $6, 
          address = $7, 
          dates_and_times = $8, 
          key_details = $9,
          images = $10,
          tag_type = $11,
          tag_class_ids = $12,
          tag_category_ids = $13,
          tag_all_parents = $14,
          tag_boosters = $15,
          tag_volunteers = $16,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING 
        id,
        event_name as "eventName",
        short_description as "shortDescription",
        long_description as "longDescription",
        start_date as "startDate",
        end_date as "endDate",
        type,
        address,
        dates_and_times as "datesAndTimes",
        key_details as "keyDetails",
        images,
        tag_type as "tagType",
        tag_class_ids as "tagClassIds",
        tag_category_ids as "tagCategoryIds",
        tag_all_parents as "tagAllParents",
        tag_boosters as "tagBoosters",
        tag_volunteers as "tagVolunteers"
    `, [
      value.eventName,
      value.shortDescription,
      value.longDescription,
      value.startDate,
      value.endDate || null,
      value.type || 'event',
      value.address || null,
      JSON.stringify(value.datesAndTimes || []),
      JSON.stringify(value.keyDetails || []),
      JSON.stringify(value.images || []),
      value.tagType || 'all_classes_and_parents',
      value.tagClassIds && value.tagClassIds.length > 0 ? value.tagClassIds : null,
      value.tagCategoryIds && value.tagCategoryIds.length > 0 ? value.tagCategoryIds : null,
      value.tagAllParents || false,
      value.tagBoosters || false,
      value.tagVolunteers || false,
      id
    ])

    const event = result.rows[0]
    
    // Log the changes if there are any and admin info is provided
    if (Object.keys(changes).length > 0 && (value.adminEmail || value.adminName)) {
      try {
        await pool.query(`
          INSERT INTO event_edit_log (event_id, admin_email, admin_name, changes)
          VALUES ($1, $2, $3, $4)
        `, [
          id,
          value.adminEmail || 'unknown@vortexathletics.com',
          value.adminName || 'Unknown Admin',
          JSON.stringify(changes)
        ])
      } catch (logError) {
        console.error('Error logging event changes:', logError)
        // Don't fail the update if logging fails
      }
    }
    
    // Parse JSONB fields
    let datesAndTimes = []
    let keyDetails = []
    let images = []
    
    try {
      datesAndTimes = typeof event.datesAndTimes === 'string' 
        ? JSON.parse(event.datesAndTimes) 
        : (event.datesAndTimes || [])
      keyDetails = typeof event.keyDetails === 'string'
        ? JSON.parse(event.keyDetails)
        : (event.keyDetails || [])
      images = typeof event.images === 'string'
        ? JSON.parse(event.images)
        : (event.images || [])
    } catch (e) {
      console.error('Error parsing JSON fields:', e)
    }
    
    // Parse dates in local timezone to avoid timezone shift
    const parseLocalDate = (dateStr) => {
      if (!dateStr) return undefined
      if (dateStr instanceof Date) return dateStr
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    
    event.startDate = parseLocalDate(event.startDate)
    event.endDate = event.endDate ? parseLocalDate(event.endDate) : undefined
    event.datesAndTimes = Array.isArray(datesAndTimes) 
      ? datesAndTimes.map(dt => ({
          ...dt,
          date: parseLocalDate(dt.date)
        }))
      : []
    event.keyDetails = Array.isArray(keyDetails) ? keyDetails : []
    event.images = Array.isArray(images) ? images : []

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    })
  } catch (error) {
    console.error('Update event error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete event (admin endpoint)
app.delete('/api/admin/events/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      })
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    })
  } catch (error) {
    console.error('Delete event error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get event edit log (admin endpoint)
app.get('/api/admin/events/:id/log', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT 
        id,
        admin_email as "adminEmail",
        admin_name as "adminName",
        changes,
        created_at as "createdAt"
      FROM event_edit_log
      WHERE event_id = $1
      ORDER BY created_at DESC
    `, [id])

    const logs = result.rows.map(log => ({
      ...log,
      changes: typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes,
      createdAt: new Date(log.createdAt)
    }))

    res.json({
      success: true,
      data: logs
    })
  } catch (error) {
    console.error('Get event log error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Seed events (admin endpoint - for initial setup)
app.post('/api/admin/events/seed', async (req, res) => {
  try {
    // Check if events already exist
    const existingCount = await pool.query('SELECT COUNT(*) FROM events')
    if (parseInt(existingCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: `Found ${existingCount.rows[0].count} existing events. Delete existing events first or use force=true parameter.`
      })
    }

    // Read and execute the seed SQL
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const migrationPath = path.join(__dirname, 'migrations', 'seed_events.sql')
    
    const sql = fs.readFileSync(migrationPath, 'utf8')
    const cleanedSql = sql.replace(/ ON CONFLICT DO NOTHING;/g, ';')
    
    await pool.query(cleanedSql)
    
    // Verify by counting events
    const result = await pool.query('SELECT COUNT(*) FROM events')
    
    res.json({
      success: true,
      message: 'Events seeded successfully',
      count: parseInt(result.rows[0].count)
    })
  } catch (error) {
    console.error('Seed events error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    })
  }
})

// Admin login (accepts username or email)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { error, value } = adminLoginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Find admin by username or email (username case-insensitive)
    const usernameOrEmail = value.usernameOrEmail.trim()
    const isEmail = usernameOrEmail.includes('@')
    
    let query, params
    if (isEmail) {
      // Email comparison is case-sensitive
      query = 'SELECT * FROM admins WHERE email = $1'
      params = [usernameOrEmail]
    } else {
      // Username comparison - case insensitive
      query = 'SELECT * FROM admins WHERE LOWER(username) = LOWER($1)'
      params = [usernameOrEmail]
    }
    
    const result = await pool.query(query, params)

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      })
    }

    const admin = result.rows[0]

    // Verify password
    const isValid = await bcrypt.compare(value.password, admin.password_hash)
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      })
    }

    // Create JWT token for admin
    console.log('[Admin Login] Starting token creation for admin:', admin.id, admin.email)
    console.log('[Admin Login] JWT_SECRET exists?', !!JWT_SECRET, 'Length:', JWT_SECRET?.length)
    
    try {
      const adminToken = jwt.sign(
        { 
          adminId: admin.id, 
          role: 'ADMIN',
          email: admin.email 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      console.log('[Admin Login] Token created successfully for admin:', admin.id, admin.email)
      console.log('[Admin Login] Token length:', adminToken.length)
      console.log('[Admin Login] Token preview:', adminToken.substring(0, 20) + '...')

      // Return admin info (without password) and token
      const responseData = {
      success: true,
      admin: {
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        email: admin.email,
        phone: admin.phone,
        username: admin.username,
        isMaster: admin.is_master
        },
        token: adminToken
      }
      
      console.log('[Admin Login] Response data keys:', Object.keys(responseData))
      console.log('[Admin Login] Response data has token?', 'token' in responseData)
      console.log('[Admin Login] Token value in response:', responseData.token ? responseData.token.substring(0, 20) + '...' : 'NULL')
      
      console.log('[Admin Login] Sending response with token')
      res.json(responseData)
      console.log('[Admin Login] Response sent successfully')
    } catch (tokenError) {
      console.error('[Admin Login] ERROR creating token:', tokenError)
      console.error('[Admin Login] Error name:', tokenError.name)
      console.error('[Admin Login] Error message:', tokenError.message)
      console.error('[Admin Login] Error stack:', tokenError.stack)
      
      // Return response without token if token creation fails (shouldn't happen, but handle gracefully)
      const errorResponse = {
        success: true,
        admin: {
          id: admin.id,
          firstName: admin.first_name,
          lastName: admin.last_name,
          email: admin.email,
          phone: admin.phone,
          username: admin.username,
          isMaster: admin.is_master
        },
        token: null,
        warning: 'Token generation failed - please contact administrator',
        error: tokenError.message
      }
      console.log('[Admin Login] Sending error response:', errorResponse)
      res.json(errorResponse)
    }
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get all admins (admin endpoint)
app.get('/api/admin/admins', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name as "firstName", last_name as "lastName", 
             email, phone, username, is_master as "isMaster", 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM admins
      ORDER BY created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get admins error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get current admin info (by ID from query param or body)
app.get('/api/admin/admins/me', async (req, res) => {
  try {
    const adminId = req.query.id || req.body.id
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID required'
      })
    }

    const result = await pool.query(`
      SELECT id, first_name as "firstName", last_name as "lastName", 
             email, phone, username, is_master as "isMaster", 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM admins
      WHERE id = $1
    `, [adminId])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Get admin error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create new admin (master admin only - check should be added in production)
app.post('/api/admin/admins', async (req, res) => {
  try {
    const { error, value } = adminSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Check if username or email already exists (username case-insensitive)
    const existing = await pool.query(
      'SELECT id FROM admins WHERE LOWER(username) = LOWER($1) OR email = $2',
      [value.username, value.email]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 10)

    // Insert admin
    const result = await pool.query(`
      INSERT INTO admins (first_name, last_name, email, phone, username, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name as "firstName", last_name as "lastName", 
                email, phone, username, is_master as "isMaster", 
                created_at as "createdAt", updated_at as "updatedAt"
    `, [
      value.firstName,
      value.lastName,
      value.email,
      value.phone || null,
      value.username,
      passwordHash
    ])

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Create admin error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// ========== PROGRAM ENDPOINTS ==========

// Get all programs (admin endpoint)
app.get('/api/admin/programs', async (req, res) => {
  try {
    const { archived } = req.query
    let query = `
      SELECT 
        p.id,
        p.category,
        p.category_id as "categoryId",
        pc.name as "categoryName",
        pc.display_name as "categoryDisplayName",
        p.name,
        p.display_name as "displayName",
        p.skill_level as "skillLevel",
        p.age_min as "ageMin",
        p.age_max as "ageMax",
        p.description,
        p.skill_requirements as "skillRequirements",
        p.is_active as "isActive",
        p.archived,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt"
      FROM program p
      LEFT JOIN program_categories pc ON p.category_id = pc.id
    `
    const params = []
    
    if (archived === 'true') {
      query += ' WHERE p.archived = $1'
      params.push(true)
    } else if (archived === 'false') {
      query += ' WHERE p.archived = $1'
      params.push(false)
    }
    
    query += ' ORDER BY p.archived ASC, pc.display_name ASC, p.skill_level NULLS LAST, p.display_name'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      programs: result.rows,
      data: result.rows
    })
  } catch (error) {
    console.error('Get programs error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create program (admin endpoint)
app.post('/api/admin/programs', async (req, res) => {
  try {
    console.log('Create program request body:', JSON.stringify(req.body, null, 2))
    const { error, value } = programSchema.validate(req.body)
    if (error) {
      console.error('Validation error:', error.details)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    console.log('Validated value:', JSON.stringify(value, null, 2))

    // Get facility_id
    const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityId.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }

    // If categoryId is provided, use it and look up the category enum value
    let categoryId = value.categoryId
    let categoryEnum = value.category || null
    
    // Get valid category enum values from database - SINGLE SOURCE OF TRUTH
    const validCategoriesResult = await pool.query(
      'SELECT DISTINCT name FROM program_categories WHERE archived = FALSE'
    )
    const validEnumValues = validCategoriesResult.rows.map(row => row.name)
    
    if (categoryId && !categoryEnum) {
      // Look up the category from the database using categoryId - SINGLE SOURCE OF TRUTH
      const categoryResult = await pool.query(
        'SELECT name FROM program_categories WHERE id = $1 AND archived = FALSE LIMIT 1',
        [categoryId]
      )
      if (categoryResult.rows.length > 0) {
        const categoryName = categoryResult.rows[0].name
        // Use category name from database (it may or may not match legacy enum)
        // Try to use as enum if it matches legacy enum values, otherwise use first available enum
        const categoryEnumResult = await pool.query(`
          SELECT unnest(enum_range(NULL::program_category))::text as enum_value
        `)
        const availableEnumValues = categoryEnumResult.rows.map(row => row.enum_value)
        
        if (availableEnumValues.includes(categoryName)) {
          categoryEnum = categoryName
        } else if (availableEnumValues.length > 0) {
          // Use first available enum value as fallback (legacy enum column requires a value)
          categoryEnum = availableEnumValues[0]
          console.warn(`Category "${categoryName}" from database doesn't match legacy enum, using ${categoryEnum} as fallback`)
        }
      } else {
        return res.status(400).json({
          success: false,
          message: `Category with id ${categoryId} not found or is archived`
        })
      }
    } else if (!categoryId && value.category) {
      // Look up categoryId from the database using category name - SINGLE SOURCE OF TRUTH
      const categoryResult = await pool.query(
        'SELECT id FROM program_categories WHERE name = $1 AND archived = FALSE LIMIT 1',
        [value.category]
      )
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id
        categoryEnum = value.category
      } else {
        // Category not found in database, return error
        return res.status(400).json({
          success: false,
          message: `Category "${value.category}" not found in database. Please create it first in the Categories tab.`
        })
      }
    }

    // If levelId is provided, use it; otherwise try to map from skillLevel enum
    let levelId = value.levelId
    if (!levelId && value.skillLevel) {
      const levelResult = await pool.query(
        'SELECT id FROM skill_levels WHERE name = $1 AND category_id = $2 LIMIT 1',
        [value.skillLevel, categoryId]
      )
      if (levelResult.rows.length > 0) {
        levelId = levelResult.rows[0].id
      }
    }

    // Check if category_id and level_id columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program' 
      AND column_name IN ('category_id', 'level_id')
    `)
    const hasCategoryIdColumn = columnCheck.rows.some(row => row.column_name === 'category_id')
    const hasLevelIdColumn = columnCheck.rows.some(row => row.column_name === 'level_id')

    // Ensure categoryEnum is a valid enum value before inserting (check against database enum type)
    if (categoryEnum) {
      const enumCheckResult = await pool.query(`
        SELECT unnest(enum_range(NULL::program_category))::text as enum_value
      `)
      const availableEnumValues = enumCheckResult.rows.map(row => row.enum_value)
      
      if (!availableEnumValues.includes(categoryEnum)) {
        // Use first available enum value as fallback (legacy enum column requires a value)
        categoryEnum = availableEnumValues.length > 0 ? availableEnumValues[0] : 'GYMNASTICS'
        console.warn(`Category enum "${categoryEnum}" not in database enum type, using ${categoryEnum} as fallback`)
      }
    }
    // If categoryEnum is still null, query database enum type for default
    if (!categoryEnum) {
      const enumCheckResult = await pool.query(`
        SELECT unnest(enum_range(NULL::program_category))::text as enum_value LIMIT 1
      `)
      categoryEnum = enumCheckResult.rows.length > 0 ? enumCheckResult.rows[0].enum_value : 'GYMNASTICS'
      console.warn(`No category enum value provided, using ${categoryEnum} as default from database`)
    }

    // Build INSERT statement based on which columns exist
    let insertColumns = ['facility_id', 'category']
    let insertValues = [facilityId.rows[0].id, categoryEnum]

    // Add category_id if column exists
    if (hasCategoryIdColumn) {
      insertColumns.push('category_id')
      insertValues.push(categoryId || null)
    }

    // Add standard columns
    insertColumns.push('name', 'display_name', 'skill_level')
    insertValues.push(
      value.name || value.displayName?.toUpperCase().replace(/\s+/g, '_') || 'CLASS',
      value.displayName,
      value.skillLevel || null
    )

    // Add level_id if column exists (after skill_level)
    if (hasLevelIdColumn) {
      insertColumns.push('level_id')
      insertValues.push(levelId || null)
    }

    // Add remaining columns
    insertColumns.push('age_min', 'age_max', 'description', 'skill_requirements', 'is_active')
    insertValues.push(
      value.ageMin || null,
      value.ageMax || null,
      value.description || null,
      value.skillRequirements || null,
      value.isActive !== undefined ? value.isActive : true
    )

    const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ')

    // Build RETURNING clause
    let returningClause = `
      id,
      category,
      ${hasCategoryIdColumn ? 'category_id as "categoryId",' : 'NULL as "categoryId",'}
      name,
      display_name as "displayName",
      skill_level as "skillLevel",
      age_min as "ageMin",
      age_max as "ageMax",
      description,
      skill_requirements as "skillRequirements",
      is_active as "isActive",
      archived,
      created_at as "createdAt",
      updated_at as "updatedAt"
    `

    const insertQuery = `
      INSERT INTO program (${insertColumns.join(', ')})
      VALUES (${placeholders})
      RETURNING ${returningClause}
    `
    
    console.log('Insert query:', insertQuery)
    console.log('Insert values:', insertValues)
    console.log('Insert columns:', insertColumns)

    const result = await pool.query(insertQuery, insertValues)
    const newProgramId = result.rows[0].id

    // Automatically create iteration 1 with default values (6pm-7:30pm, Mon-Fri, indefinite)
    try {
      await pool.query(`
        INSERT INTO class_iteration (
          program_id,
          iteration_number,
          days_of_week,
          start_time,
          end_time,
          duration_type
        )
        VALUES ($1, 1, ARRAY[1,2,3,4,5], '18:00:00', '19:30:00', 'indefinite')
      `, [newProgramId])
    } catch (iterationError) {
      console.error('Error creating default iteration:', iterationError)
      // Don't fail the program creation if iteration creation fails
    }

    res.json({
      success: true,
      message: 'Program created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Create program error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    })
    
    // Return more detailed error information
    let errorMessage = 'Internal server error'
    if (error.code === '23505') { // Unique violation
      errorMessage = 'A program with this name already exists'
    } else if (error.code === '23503') { // Foreign key violation
      errorMessage = `Invalid reference: ${error.detail || error.message}`
    } else if (error.code === '23502') { // Not null violation
      errorMessage = `Required field missing: ${error.column || 'unknown field'}`
    } else if (error.message) {
      errorMessage = error.message
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      detail: process.env.NODE_ENV === 'development' ? error.detail : undefined,
      code: process.env.NODE_ENV === 'development' ? error.code : undefined
    })
  }
})

// Update program (admin endpoint)
app.put('/api/admin/programs/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = programUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Check if category_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program' 
      AND column_name = 'category_id'
    `)
    const hasCategoryIdColumn = columnCheck.rows.length > 0

    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1

    // Handle categoryId update if provided and column exists
    if (hasCategoryIdColumn && value.categoryId !== undefined) {
      updates.push(`category_id = $${paramCount++}`)
      values.push(value.categoryId)
      
      // If categoryId is being set, update the category enum to match
      if (value.categoryId !== null) {
        const categoryResult = await pool.query(
          'SELECT name FROM program_categories WHERE id = $1 AND archived = FALSE LIMIT 1',
          [value.categoryId]
        )
        if (categoryResult.rows.length > 0) {
          const categoryName = categoryResult.rows[0].name
          // Check if category name matches database enum type (legacy column requirement)
          const enumCheckResult = await pool.query(`
            SELECT unnest(enum_range(NULL::program_category))::text as enum_value
          `)
          const availableEnumValues = enumCheckResult.rows.map(row => row.enum_value)
          
          if (availableEnumValues.includes(categoryName)) {
            updates.push(`category = $${paramCount++}`)
            values.push(categoryName)
          } else if (availableEnumValues.length > 0) {
            // Use first available enum value as fallback (legacy enum column requires a value)
            updates.push(`category = $${paramCount++}`)
            values.push(availableEnumValues[0])
            console.warn(`Category "${categoryName}" from database doesn't match legacy enum, using ${availableEnumValues[0]} as fallback`)
          }
        }
      } else {
        // If categoryId is being set to null, don't change category enum (keep existing)
        // But we could set it to null if needed - for now, keep existing enum value
      }
    }

    if (value.displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(value.displayName)
    }
    if (value.skillLevel !== undefined) {
      updates.push(`skill_level = $${paramCount++}`)
      values.push(value.skillLevel ? value.skillLevel : null)
    }
    if (value.ageMin !== undefined) {
      updates.push(`age_min = $${paramCount++}`)
      values.push(value.ageMin)
    }
    if (value.ageMax !== undefined) {
      updates.push(`age_max = $${paramCount++}`)
      values.push(value.ageMax)
    }
    if (value.description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(value.description || null)
    }
    if (value.skillRequirements !== undefined) {
      updates.push(`skill_requirements = $${paramCount++}`)
      values.push(value.skillRequirements || null)
    }
    if (value.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`)
      values.push(value.isActive)
    }
    if (value.archived !== undefined) {
      updates.push(`archived = $${paramCount++}`)
      values.push(value.archived)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    // Build RETURNING clause with category info
    let returningClause = `
      id,
      category,
      ${hasCategoryIdColumn ? 'category_id as "categoryId",' : 'NULL as "categoryId",'}
      name,
      display_name as "displayName",
      skill_level as "skillLevel",
      age_min as "ageMin",
      age_max as "ageMax",
      description,
      skill_requirements as "skillRequirements",
      is_active as "isActive",
      archived,
      created_at as "createdAt",
      updated_at as "updatedAt"
    `

    const result = await pool.query(`
      UPDATE program
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING ${returningClause}
    `, values)

    // If categoryId exists, fetch category display name separately
    if (hasCategoryIdColumn && result.rows.length > 0 && result.rows[0].categoryId) {
      const categoryInfo = await pool.query(`
        SELECT name, display_name 
        FROM program_categories 
        WHERE id = $1
      `, [result.rows[0].categoryId])
      
      if (categoryInfo.rows.length > 0) {
        result.rows[0].categoryName = categoryInfo.rows[0].name
        result.rows[0].categoryDisplayName = categoryInfo.rows[0].display_name
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      })
    }

    res.json({
      success: true,
      message: 'Program updated successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Update program error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/Unarchive program (admin endpoint)
app.patch('/api/admin/programs/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body

    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }

    // Check if category_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program' 
      AND column_name = 'category_id'
    `)
    const hasCategoryIdColumn = columnCheck.rows.length > 0

    const result = await pool.query(`
      UPDATE program 
      SET archived = $1, 
          is_active = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING 
        id,
        category,
        ${hasCategoryIdColumn ? 'category_id as "categoryId",' : 'NULL as "categoryId",'}
        name,
        display_name as "displayName",
        skill_level as "skillLevel",
        age_min as "ageMin",
        age_max as "ageMax",
        description,
        skill_requirements as "skillRequirements",
        is_active as "isActive",
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [archived, !archived, id]) // When archived = true, set is_active = false (inactive), and vice versa

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      })
    }

    // Fetch category display name if categoryId exists
    const programData = result.rows[0]
    if (hasCategoryIdColumn && programData.categoryId) {
      const categoryInfo = await pool.query(`
        SELECT name, display_name 
        FROM program_categories 
        WHERE id = $1
      `, [programData.categoryId])
      
      if (categoryInfo.rows.length > 0) {
        programData.categoryName = categoryInfo.rows[0].name
        programData.categoryDisplayName = categoryInfo.rows[0].display_name
      }
    }

    res.json({
      success: true,
      message: archived ? 'Program archived successfully' : 'Program unarchived successfully',
      data: programData
    })
  } catch (error) {
    console.error('Archive program error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete program (admin endpoint)
app.delete('/api/admin/programs/:id', async (req, res) => {
  try {
    const { id } = req.params

    // First check if program exists
    const checkResult = await pool.query('SELECT id FROM program WHERE id = $1', [id])
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      })
    }

    // Delete the program
    const result = await pool.query('DELETE FROM program WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      })
    }

    res.json({
      success: true,
      message: 'Program deleted successfully'
    })
  } catch (error) {
    console.error('Delete program error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// ========== CLASS ITERATION ENDPOINTS ==========

// Get all iterations for a program
app.get('/api/admin/programs/:programId/iterations', async (req, res) => {
  try {
    const { programId } = req.params
    
    // Ensure table exists (create if missing)
    try {
      await ensureClassIterationTable()
    } catch (error) {
      // If table creation fails, return empty array gracefully
      console.warn('Could not ensure class_iteration table exists:', error.message)
      return res.json({
        success: true,
        data: [],
        warning: 'class_iteration table not available'
      })
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        program_id as "programId",
        iteration_number as "iterationNumber",
        days_of_week as "daysOfWeek",
        start_time as "startTime",
        end_time as "endTime",
        time_blocks as "timeBlocks",
        duration_type as "durationType",
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM class_iteration
      WHERE program_id = $1
      ORDER BY iteration_number ASC
    `, [programId])

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get iterations error:', error)
    // If table doesn't exist, return empty array instead of error
    if (error.message && (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('class_iteration'))) {
      console.warn('class_iteration table does not exist - returning empty array')
      return res.json({
        success: true,
        data: [],
        warning: 'class_iteration table not found - migration may be needed'
      })
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Helper function to ensure class_iteration table exists
const ensureClassIterationTable = async () => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'class_iteration'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating class_iteration table...')
      
      // First, verify the program table exists (required for foreign key)
      const programTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'program'
        )
      `)
      
      if (!programTableCheck.rows[0].exists) {
        throw new Error('Cannot create class_iteration table: program table does not exist')
      }
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS class_iteration (
          id                  BIGSERIAL PRIMARY KEY,
          program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
          iteration_number    INTEGER NOT NULL,
          days_of_week        INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK (array_length(days_of_week, 1) > 0),
          start_time          TIME NOT NULL DEFAULT '18:00:00',
          end_time            TIME NOT NULL DEFAULT '19:30:00',
          time_blocks         JSONB DEFAULT NULL,
          duration_type       VARCHAR(20) NOT NULL DEFAULT 'indefinite' CHECK (duration_type IN ('indefinite', '3_month_block', 'finite')),
          start_date          DATE,
          end_date            DATE,
          created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (program_id, iteration_number)
        )
      `)
      
      // Add time_blocks column if it doesn't exist (for existing tables)
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'class_iteration' AND column_name = 'time_blocks'
          ) THEN
            ALTER TABLE class_iteration ADD COLUMN time_blocks JSONB DEFAULT NULL;
          END IF;
        END $$;
      `)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_program ON class_iteration(program_id)`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_number ON class_iteration(program_id, iteration_number)`)
      console.log('✅ class_iteration table created successfully')
    } else {
      console.log('✅ class_iteration table already exists')
    }
  } catch (error) {
    console.error('❌ Error ensuring class_iteration table exists:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    })
    throw error
  }
}

// Create a new iteration for a program
app.post('/api/admin/programs/:programId/iterations', async (req, res) => {
  try {
    const { programId } = req.params
    const { daysOfWeek, startTime, endTime, timeBlocks, durationType, startDate, endDate } = req.body

    // Validate program exists
    const programCheck = await pool.query('SELECT id FROM program WHERE id = $1', [programId])
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      })
    }

    // Ensure table exists (create if missing)
    try {
      await ensureClassIterationTable()
    } catch (tableError) {
      console.error('Failed to ensure class_iteration table exists:', tableError)
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize class_iteration table',
        error: process.env.NODE_ENV === 'development' ? tableError.message : undefined,
        details: process.env.NODE_ENV === 'development' ? {
          code: tableError.code,
          detail: tableError.detail,
          hint: tableError.hint
        } : undefined
      })
    }

    // Get the next iteration number
    const maxIterationResult = await pool.query(
      'SELECT COALESCE(MAX(iteration_number), 0) as max_num FROM class_iteration WHERE program_id = $1',
      [programId]
    )
    const nextIterationNumber = (maxIterationResult.rows[0].max_num || 0) + 1

    // Default values
    const defaultDaysOfWeek = daysOfWeek || [1, 2, 3, 4, 5] // Mon-Fri
    const defaultStartTime = startTime || '18:00:00' // 6pm
    const defaultEndTime = endTime || '19:30:00' // 7:30pm
    const defaultDurationType = durationType || 'indefinite'

    // Validate duration type specific fields
    if (defaultDurationType === 'finite' && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required for finite duration'
      })
    }

    if (defaultDurationType === '3_month_block' && !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required for 3-month block duration'
      })
    }

    // Process timeBlocks if provided
    // Store timeBlocks if provided (even if single block), otherwise null for backward compatibility
    // For JSONB columns, pass the JavaScript object directly - pg will handle conversion
    let timeBlocksValue = null
    if (timeBlocks && Array.isArray(timeBlocks) && timeBlocks.length > 0) {
      timeBlocksValue = timeBlocks // Pass object directly for JSONB
    }

    const result = await pool.query(`
      INSERT INTO class_iteration (
        program_id,
        iteration_number,
        days_of_week,
        start_time,
        end_time,
        time_blocks,
        duration_type,
        start_date,
        end_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id,
        program_id as "programId",
        iteration_number as "iterationNumber",
        days_of_week as "daysOfWeek",
        start_time as "startTime",
        end_time as "endTime",
        time_blocks as "timeBlocks",
        duration_type as "durationType",
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [
      programId,
      nextIterationNumber,
      defaultDaysOfWeek,
      defaultStartTime,
      defaultEndTime,
      timeBlocksValue,
      defaultDurationType,
      defaultDurationType === 'indefinite' ? null : startDate,
      defaultDurationType === 'finite' ? endDate : null
    ])

    res.json({
      success: true,
      message: 'Iteration created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Create iteration error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      } : undefined
    })
  }
})

// Update an iteration
app.put('/api/admin/programs/:programId/iterations/:iterationId', async (req, res) => {
  try {
    const { programId, iterationId } = req.params
    const { daysOfWeek, startTime, endTime, timeBlocks, durationType, startDate, endDate } = req.body

    // Ensure table exists (create if missing)
    try {
      await ensureClassIterationTable()
    } catch (tableError) {
      console.error('Failed to ensure class_iteration table exists:', tableError)
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize class_iteration table',
        error: process.env.NODE_ENV === 'development' ? tableError.message : undefined
      })
    }

    // Validate iteration exists and belongs to program
    const checkResult = await pool.query(
      'SELECT id FROM class_iteration WHERE id = $1 AND program_id = $2',
      [iterationId, programId]
    )
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Iteration not found'
      })
    }

    // Validate duration type specific fields
    if (durationType === 'finite' && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required for finite duration'
      })
    }

    if (durationType === '3_month_block' && !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required for 3-month block duration'
      })
    }

    // Process timeBlocks if provided
    // Store timeBlocks if provided (even if single block), otherwise null for backward compatibility
    // For JSONB columns, pass the JavaScript object directly - pg will handle conversion
    let timeBlocksValue = null
    if (timeBlocks && Array.isArray(timeBlocks) && timeBlocks.length > 0) {
      timeBlocksValue = timeBlocks // Pass object directly for JSONB
    }

    const result = await pool.query(`
      UPDATE class_iteration
      SET 
        days_of_week = $1,
        start_time = $2,
        end_time = $3,
        time_blocks = $4,
        duration_type = $5,
        start_date = $6,
        end_date = $7,
        updated_at = now()
      WHERE id = $8 AND program_id = $9
      RETURNING 
        id,
        program_id as "programId",
        iteration_number as "iterationNumber",
        days_of_week as "daysOfWeek",
        start_time as "startTime",
        end_time as "endTime",
        time_blocks as "timeBlocks",
        duration_type as "durationType",
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [
      daysOfWeek,
      startTime,
      endTime,
      timeBlocksValue,
      durationType,
      durationType === 'indefinite' ? null : startDate,
      durationType === 'finite' ? endDate : null,
      iterationId,
      programId
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Iteration not found'
      })
    }

    res.json({
      success: true,
      message: 'Iteration updated successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Update iteration error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Delete an iteration
app.delete('/api/admin/programs/:programId/iterations/:iterationId', async (req, res) => {
  try {
    const { programId, iterationId } = req.params

    // Ensure table exists (create if missing)
    try {
      await ensureClassIterationTable()
    } catch (tableError) {
      console.error('Failed to ensure class_iteration table exists:', tableError)
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize class_iteration table',
        error: process.env.NODE_ENV === 'development' ? tableError.message : undefined
      })
    }

    // Validate iteration exists and belongs to program
    const checkResult = await pool.query(
      'SELECT id FROM class_iteration WHERE id = $1 AND program_id = $2',
      [iterationId, programId]
    )
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Iteration not found'
      })
    }

    await pool.query(
      'DELETE FROM class_iteration WHERE id = $1 AND program_id = $2',
      [iterationId, programId]
    )

    res.json({
      success: true,
      message: 'Iteration deleted successfully'
    })
  } catch (error) {
    console.error('Delete iteration error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// ========== CATEGORY ENDPOINTS ==========

// Get all categories (admin endpoint)
app.get('/api/admin/categories', async (req, res) => {
  try {
    const { archived } = req.query
    
    // Check if description column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program_categories' 
      AND column_name = 'description'
    `)
    const hasDescriptionColumn = columnCheck.rows.length > 0
    
    let query = `
      SELECT 
        id,
        name,
        display_name as "displayName",
        ${hasDescriptionColumn ? 'description,' : 'NULL as description,'}
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM program_categories
    `
    const params = []
    
    if (archived === 'true') {
      query += ' WHERE archived = $1'
      params.push(true)
    } else if (archived === 'false') {
      query += ' WHERE archived = $1'
      params.push(false)
    }
    
    query += ' ORDER BY archived ASC, display_name ASC'
    
    const result = await pool.query(query, params)

    res.json({
      success: true,
      categories: result.rows,
      data: result.rows
    })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create category (admin endpoint)
app.post('/api/admin/categories', async (req, res) => {
  try {
    const { error, value } = categorySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityId.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }

    // Check if description column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program_categories' 
      AND column_name = 'description'
    `)
    const hasDescriptionColumn = columnCheck.rows.length > 0

    let query, params
    if (hasDescriptionColumn) {
      query = `
        INSERT INTO program_categories (facility_id, name, display_name, description)
        VALUES ($1, $2, $3, $4)
        RETURNING 
          id,
          name,
          display_name as "displayName",
          description,
          archived,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `
      params = [facilityId.rows[0].id, value.name.toUpperCase().replace(/\s+/g, '_'), value.displayName, value.description || null]
    } else {
      query = `
        INSERT INTO program_categories (facility_id, name, display_name)
        VALUES ($1, $2, $3)
        RETURNING 
          id,
          name,
          display_name as "displayName",
          NULL as description,
          archived,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `
      params = [facilityId.rows[0].id, value.name.toUpperCase().replace(/\s+/g, '_'), value.displayName]
    }

    const result = await pool.query(query, params)

    res.json({
      success: true,
      message: 'Category created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists'
      })
    }
    console.error('Create category error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update category (admin endpoint)
app.put('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = categoryUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const updates = []
    const values = []
    let paramCount = 1

    if (value.name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      values.push(value.name.toUpperCase().replace(/\s+/g, '_'))
    }
    if (value.displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(value.displayName)
    }
    
    // Check if description column exists before trying to update it
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program_categories' 
      AND column_name = 'description'
    `)
    const hasDescriptionColumn = columnCheck.rows.length > 0
    
    if (value.description !== undefined && hasDescriptionColumn) {
      updates.push(`description = $${paramCount++}`)
      values.push(value.description || null)
    }

    if (value.archived !== undefined) {
      updates.push(`archived = $${paramCount++}`)
      values.push(value.archived)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const returnDescription = hasDescriptionColumn ? 'description,' : 'NULL as description,'
    const result = await pool.query(`
      UPDATE program_categories
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        name,
        display_name as "displayName",
        ${returnDescription}
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Category with this name already exists'
      })
    }
    console.error('Update category error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/Unarchive category (admin endpoint)
app.patch('/api/admin/categories/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body

    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }

    const result = await pool.query(`
      UPDATE program_categories 
      SET archived = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING 
        id,
        display_name as "displayName",
        archived
    `, [archived, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    res.json({
      success: true,
      message: archived ? 'Category archived successfully' : 'Category unarchived successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Archive category error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete category (admin endpoint)
app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if category has programs
    const programsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM program WHERE category_id = $1',
      [id]
    )

    if (parseInt(programsCheck.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete category with existing programs. Archive it instead.'
      })
    }

    const result = await pool.query(
      'DELETE FROM program_categories WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// ========== LEVEL ENDPOINTS ==========

// Get all levels for a category (admin endpoint)
app.get('/api/admin/levels', async (req, res) => {
  try {
    const { categoryId, archived } = req.query
    let query = `
      SELECT 
        sl.id,
        sl.category_id as "categoryId",
        pc.name as "categoryName",
        pc.display_name as "categoryDisplayName",
        sl.name,
        sl.display_name as "displayName",
        sl.archived,
        sl.created_at as "createdAt",
        sl.updated_at as "updatedAt"
      FROM skill_levels sl
      JOIN program_categories pc ON sl.category_id = pc.id
    `
    const params = []
    let paramCount = 1

    if (categoryId) {
      query += ` WHERE sl.category_id = $${paramCount++}`
      params.push(categoryId)
      
      if (archived === 'true') {
        query += ` AND sl.archived = $${paramCount++}`
        params.push(true)
      } else if (archived === 'false') {
        query += ` AND sl.archived = $${paramCount++}`
        params.push(false)
      }
    } else if (archived === 'true') {
      query += ` WHERE sl.archived = $${paramCount++}`
      params.push(true)
    } else if (archived === 'false') {
      query += ` WHERE sl.archived = $${paramCount++}`
      params.push(false)
    }
    
    query += ' ORDER BY sl.archived ASC, pc.display_name ASC, sl.display_name ASC'
    
    const result = await pool.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get levels error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create level (admin endpoint)
app.post('/api/admin/levels', async (req, res) => {
  try {
    const { error, value } = levelSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityId.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }

    const result = await pool.query(`
      INSERT INTO skill_levels (facility_id, category_id, name, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        category_id as "categoryId",
        name,
        display_name as "displayName",
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [facilityId.rows[0].id, value.categoryId, value.name.toUpperCase().replace(/\s+/g, '_'), value.displayName])

    res.json({
      success: true,
      message: 'Level created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Level with this name already exists for this category'
      })
    }
    console.error('Create level error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update level (admin endpoint)
app.put('/api/admin/levels/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = levelUpdateSchema.validate(req.body, { 
      allowUnknown: true, // Allow unknown fields like categoryId (we'll ignore them)
      stripUnknown: true  // Strip unknown fields
    })
    if (error) {
      console.error('Level update validation error:', error.details)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const updates = []
    const values = []
    let paramCount = 1

    if (value.name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      values.push(value.name.toUpperCase().replace(/\s+/g, '_'))
    }
    if (value.displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(value.displayName)
    }
    if (value.archived !== undefined) {
      updates.push(`archived = $${paramCount++}`)
      values.push(value.archived)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const result = await pool.query(`
      UPDATE skill_levels
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        category_id as "categoryId",
        name,
        display_name as "displayName",
        archived,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Level not found'
      })
    }

    res.json({
      success: true,
      message: 'Level updated successfully',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Level with this name already exists for this category'
      })
    }
    console.error('Update level error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Archive/Unarchive level (admin endpoint)
app.patch('/api/admin/levels/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archived } = req.body

    if (typeof archived !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'archived must be a boolean value'
      })
    }

    const result = await pool.query(`
      UPDATE skill_levels 
      SET archived = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING 
        id,
        display_name as "displayName",
        archived
    `, [archived, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Level not found'
      })
    }

    res.json({
      success: true,
      message: archived ? 'Level archived successfully' : 'Level unarchived successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Archive level error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete level (admin endpoint)
app.delete('/api/admin/levels/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if level has programs
    const programsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM program WHERE level_id = $1',
      [id]
    )

    if (parseInt(programsCheck.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete level with existing programs. Archive it instead.'
      })
    }

    const result = await pool.query(
      'DELETE FROM skill_levels WHERE id = $1 RETURNING id',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Level not found'
      })
    }

    res.json({
      success: true,
      message: 'Level deleted successfully'
    })
  } catch (error) {
    console.error('Delete level error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update admin (admin can update their own info)
app.put('/api/admin/admins/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = adminUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1

    if (value.firstName) {
      updates.push(`first_name = $${paramCount++}`)
      values.push(value.firstName)
    }
    if (value.lastName) {
      updates.push(`last_name = $${paramCount++}`)
      values.push(value.lastName)
    }
    if (value.email) {
      updates.push(`email = $${paramCount++}`)
      values.push(value.email)
    }
    if (value.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`)
      values.push(value.phone || null)
    }
    if (value.username) {
      // Check if username already exists (excluding current admin, case-insensitive)
      const existing = await pool.query(
        'SELECT id FROM admins WHERE LOWER(username) = LOWER($1) AND id != $2',
        [value.username, id]
      )
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        })
      }
      updates.push(`username = $${paramCount++}`)
      values.push(value.username)
    }
    if (value.password) {
      const passwordHash = await bcrypt.hash(value.password, 10)
      updates.push(`password_hash = $${paramCount++}`)
      values.push(passwordHash)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const result = await pool.query(`
      UPDATE admins
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, first_name as "firstName", last_name as "lastName", 
                email, phone, username, is_master as "isMaster", 
                created_at as "createdAt", updated_at as "updatedAt"
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Update admin error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Global error handler middleware - must be last, before 404 handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err)
  console.error('Error stack:', err.stack)
  
  // Ensure CORS headers are always set, even on errors
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  
  // Don't send response if headers were already sent
  if (res.headersSent) {
    return next(err)
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

// 404 handler - must be after error handler
app.use('*', (req, res) => {
  // Ensure CORS headers are set for 404 responses
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  res.status(404).json({
    success: false,
    message: 'Route not found'
  })
})

// 404 handler
app.use((req, res) => {
  // Ensure CORS headers are set for 404 responses
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  res.status(404).json({
    success: false,
    message: 'Route not found'
  })
})

// Start server
const startServer = async () => {
  const workerId = process.env.RENDER_SERVICE_ID || process.pid || 'unknown'
  console.log(`[Server ${workerId}] Starting server initialization on worker ${workerId}...`)
  try {
    await initDatabase()
    console.log(`[Server ${workerId}] Database initialization complete`)
    
    // Log registered routes for debugging
    console.log(`[Server ${workerId}] Checking registered routes...`)
    let routeCount = 0
    let enrollmentFound = false
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase()
        console.log(`[Server ${workerId}]   ${methods} ${middleware.route.path}`)
        routeCount++
        if (middleware.route.path === '/api/members/enroll') {
          enrollmentFound = true
          console.log(`[Server ${workerId}]   ✅ Found enrollment endpoint: ${methods} ${middleware.route.path}`)
        }
      }
    })
    console.log(`[Server ${workerId}] Total routes registered: ${routeCount}`)
    if (!enrollmentFound) {
      console.error(`[Server ${workerId}] ⚠️ WARNING: Enrollment endpoint NOT found in registered routes!`)
    }
  
  // Only start the HTTP server if not running as a migration script
  if (process.env.RUN_MIGRATION_ONLY !== 'true') {
    app.listen(PORT, () => {
        console.log(`[Server ${workerId}] 🚀 Server running on port ${PORT} (worker ${workerId})`)
        console.log(`[Server ${workerId}] 📊 Health check: http://localhost:${PORT}/api/health`)
        console.log(`[Server ${workerId}] 📝 Registrations: http://localhost:${PORT}/api/registrations`)
        console.log(`[Server ${workerId}] 📧 Newsletter: http://localhost:${PORT}/api/newsletter`)
        console.log(`[Server ${workerId}] 📝 Enrollment: POST http://localhost:${PORT}/api/members/enroll`)
        if (!enrollmentFound) {
          console.error(`[Server ${workerId}] ⚠️ ERROR: Enrollment endpoint missing on worker ${workerId}!`)
        }
      })
    } else {
      console.log('[Server] Running as migration script, skipping HTTP server')
    }
  } catch (error) {
    console.error('[Server] Error starting server:', error)
    throw error
  }
}

// Only auto-start if not imported as a module
if (!process.env.RUN_MIGRATION_ONLY) {
  startServer().catch(console.error)
}

// ========== TEMPORARY MIGRATION ENDPOINT ==========
// ⚠️ REMOVE THIS ENDPOINT AFTER RUNNING THE MIGRATION ON PRODUCTION!
// This is a one-time endpoint to run the migration on production
app.post('/api/admin/run-migration', async (req, res) => {
  try {
    const { migrationFile, secretKey } = req.body
    
    // Require a secret key for security (set this as an environment variable)
    const requiredSecret = process.env.MIGRATION_SECRET_KEY || 'temporary-migration-key-change-me'
    if (secretKey !== requiredSecret) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - invalid secret key' 
      })
    }
    
    if (migrationFile !== 'add_categories_levels_tables.sql') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid migration file. Only add_categories_levels_tables.sql is allowed.' 
      })
    }
    
    console.log('🔄 Running migration via API endpoint:', migrationFile)
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFile)
    
    if (!fs.existsSync(migrationPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Migration file not found' 
      })
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8')
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      
      console.log('✅ Migration completed successfully via API')
      
      res.json({ 
        success: true, 
        message: 'Migration completed successfully',
        note: '⚠️ Please remove this endpoint after migration is complete!'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Migration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Check server logs for details'
    })
  }
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...')
  try {
    await pool.end()
    console.log('✅ PostgreSQL connection pool closed')
  } catch (err) {
    console.error('❌ Error closing database pool:', err)
  }
  process.exit(0)
})
