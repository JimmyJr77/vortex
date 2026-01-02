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
  // Allow from environment variable if set
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
].filter(Boolean) // Remove any undefined values

// Helper function to check if origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return true // Allow requests with no origin
  
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '')
  return allowedOrigins.some(allowed => {
    const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, '')
    return normalizedOrigin === normalizedAllowed
  })
}

// Handle preflight OPTIONS requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin
  console.log('OPTIONS preflight request from origin:', origin)
  
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.header('Access-Control-Max-Age', '86400') // 24 hours
    res.sendStatus(204)
  } else {
    console.warn(`CORS blocked OPTIONS request from origin: ${origin}`)
    res.sendStatus(403)
  }
})

app.use(cors({
  origin: function (origin, callback) {
    // Log the origin for debugging
    console.log('CORS request from origin:', origin)
    
    if (isOriginAllowed(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}`)
      console.warn('Allowed origins:', allowedOrigins)
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

    // Members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        password_hash VARCHAR(255) NOT NULL,
        account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'hold', 'canceled', 'past_due')),
        program VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Member children table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_children (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        date_of_birth DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

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
    
    // Create user_role enum
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('OWNER_ADMIN', 'COACH', 'PARENT_GUARDIAN', 'ATHLETE_VIEWER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `)

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
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (facility_id, email)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_facility_role ON app_user(facility_id, role)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_active ON app_user(is_active)`)

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

    // Migrate existing members to app_user as PARENT_GUARDIAN
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
        'PARENT_GUARDIAN'::user_role as role,
        email,
        phone,
        COALESCE(first_name || ' ' || last_name, 'Member') as full_name,
        password_hash,
        CASE 
          WHEN account_status = 'active' THEN TRUE 
          ELSE FALSE 
        END as is_active,
        created_at,
        updated_at
      FROM members
      WHERE NOT EXISTS (
        SELECT 1 FROM app_user 
        WHERE app_user.email = members.email
      )
    `)

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
        'little_twisters_athleticism',
        'Little Twisters — Early Stage',
        'EARLY_STAGE'::skill_level,
        4,
        5,
        'Foundational athletic development focusing on balance, coordination, running, jumping, and playful strength.',
        'No Experience Required'
      WHERE NOT EXISTS (SELECT 1 FROM program WHERE name = 'little_twisters_athleticism')
    `)

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

const memberSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).optional().allow('', null),
  address: Joi.string().max(500).optional().allow('', null),
  password: Joi.string().min(6).required(),
  program: Joi.string().max(100).optional().allow('', null),
  notes: Joi.string().max(2000).optional().allow('', null),
  children: Joi.array().items(Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    dateOfBirth: Joi.date().required()
  })).optional().default([])
})

const memberLoginSchema = Joi.object({
  email: Joi.string().email().required(),
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
  adminEmail: Joi.string().email().optional(),
  adminName: Joi.string().optional()
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

// Middleware to verify JWT token
const authenticateMember = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.memberId = decoded.memberId
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
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

    try {
      const memberCount = await pool.query('SELECT COUNT(*) as count FROM members')
      results.memberTableCount = parseInt(memberCount.rows[0].count)
    } catch (error) {
      // members table might not exist, that's OK
    }

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

// Create member (admin endpoint)
app.post('/api/admin/members', async (req, res) => {
  try {
    const { error, value } = memberSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Check if email already exists
    const existingMember = await pool.query(
      'SELECT id FROM members WHERE email = $1',
      [value.email]
    )

    if (existingMember.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 10)

    // Insert member
    const result = await pool.query(`
      INSERT INTO members 
      (first_name, last_name, email, phone, address, password_hash, program, notes, account_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING id, first_name, last_name, email, phone, address, account_status, program, notes, created_at
    `, [
      value.firstName,
      value.lastName,
      value.email,
      value.phone || null,
      value.address || null,
      passwordHash,
      value.program || null,
      value.notes || null
    ])

    const memberId = result.rows[0].id

    // Insert children if provided
    if (value.children && value.children.length > 0) {
      for (const child of value.children) {
        await pool.query(`
          INSERT INTO member_children (member_id, first_name, last_name, date_of_birth)
          VALUES ($1, $2, $3, $4)
        `, [memberId, child.firstName, child.lastName, child.dateOfBirth])
      }
    }

    // Fetch member with children
    const memberResult = await pool.query(`
      SELECT m.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'dateOfBirth', c.date_of_birth
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as children
      FROM members m
      LEFT JOIN member_children c ON m.id = c.member_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [memberId])

    res.json({
      success: true,
      message: 'Member created successfully',
      data: memberResult.rows[0]
    })
  } catch (error) {
    console.error('Create member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get all members (admin endpoint)
app.get('/api/admin/members', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'dateOfBirth', c.date_of_birth
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as children
      FROM members m
      LEFT JOIN member_children c ON m.id = c.member_id
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get members error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get single member (admin endpoint)
app.get('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`
      SELECT m.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'dateOfBirth', c.date_of_birth
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as children
      FROM members m
      LEFT JOIN member_children c ON m.id = c.member_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Get member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Update member (admin endpoint)
app.put('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { firstName, lastName, email, phone, address, accountStatus, program, notes, children } = req.body

    // Update member
    await pool.query(`
      UPDATE members 
      SET first_name = $1, last_name = $2, email = $3, phone = $4, address = $5, 
          account_status = $6, program = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `, [firstName, lastName, email, phone || null, address || null, accountStatus || 'active', program || null, notes || null, id])

    // Delete existing children
    await pool.query('DELETE FROM member_children WHERE member_id = $1', [id])

    // Insert new children
    if (children && children.length > 0) {
      for (const child of children) {
        await pool.query(`
          INSERT INTO member_children (member_id, first_name, last_name, date_of_birth)
          VALUES ($1, $2, $3, $4)
        `, [id, child.firstName, child.lastName, child.dateOfBirth])
      }
    }

    res.json({
      success: true,
      message: 'Member updated successfully'
    })
  } catch (error) {
    console.error('Update member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Delete member (admin endpoint)
app.delete('/api/admin/members/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM members WHERE id = $1', [id])

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

// Member login
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

    // Find member by email
    const result = await pool.query('SELECT * FROM members WHERE email = $1', [value.email])
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const member = result.rows[0]

    // Check account status
    if (member.account_status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${member.account_status}. Please contact support.`
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(value.password, member.password_hash)
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      { memberId: member.id, email: member.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    // Get member with children
    const memberWithChildren = await pool.query(`
      SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.address, 
             m.account_status, m.program, m.notes, m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'dateOfBirth', c.date_of_birth
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as children
      FROM members m
      LEFT JOIN member_children c ON m.id = c.member_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [member.id])

    res.json({
      success: true,
      message: 'Login successful',
      token,
      member: memberWithChildren.rows[0]
    })
  } catch (error) {
    console.error('Member login error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get current member (protected endpoint)
app.get('/api/members/me', authenticateMember, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.address, 
             m.account_status, m.program, m.notes, m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'dateOfBirth', c.date_of_birth
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as children
      FROM members m
      LEFT JOIN member_children c ON m.id = c.member_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [req.memberId])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Get member error:', error)
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
      
      try {
        datesAndTimes = typeof event.datesAndTimes === 'string' 
          ? JSON.parse(event.datesAndTimes) 
          : (event.datesAndTimes || [])
        keyDetails = typeof event.keyDetails === 'string'
          ? JSON.parse(event.keyDetails)
          : (event.keyDetails || [])
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
        keyDetails: Array.isArray(keyDetails) ? keyDetails : []
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
      
      try {
        datesAndTimes = typeof event.datesAndTimes === 'string' 
          ? JSON.parse(event.datesAndTimes) 
          : (event.datesAndTimes || [])
        keyDetails = typeof event.keyDetails === 'string'
          ? JSON.parse(event.keyDetails)
          : (event.keyDetails || [])
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
        keyDetails: Array.isArray(keyDetails) ? keyDetails : []
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
      (event_name, short_description, long_description, start_date, end_date, type, address, dates_and_times, key_details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        key_details as "keyDetails"
    `, [
      value.eventName,
      value.shortDescription,
      value.longDescription,
      value.startDate,
      value.endDate || null,
      value.type || 'event',
      value.address || null,
      JSON.stringify(value.datesAndTimes || []),
      JSON.stringify(value.keyDetails || [])
    ])

    const event = result.rows[0]
    
    // Parse JSONB fields
    let datesAndTimes = []
    let keyDetails = []
    
    try {
      datesAndTimes = typeof event.datesAndTimes === 'string' 
        ? JSON.parse(event.datesAndTimes) 
        : (event.datesAndTimes || [])
      keyDetails = typeof event.keyDetails === 'string'
        ? JSON.parse(event.keyDetails)
        : (event.keyDetails || [])
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
        key_details
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
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
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
        key_details as "keyDetails"
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
    
    try {
      datesAndTimes = typeof event.datesAndTimes === 'string' 
        ? JSON.parse(event.datesAndTimes) 
        : (event.datesAndTimes || [])
      keyDetails = typeof event.keyDetails === 'string'
        ? JSON.parse(event.keyDetails)
        : (event.keyDetails || [])
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

    // Find admin by username or email
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 OR email = $1',
      [value.usernameOrEmail]
    )

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

    // Return admin info (without password)
    res.json({
      success: true,
      admin: {
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        email: admin.email,
        phone: admin.phone,
        username: admin.username,
        isMaster: admin.is_master
      }
    })
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

    // Check if username or email already exists
    const existing = await pool.query(
      'SELECT id FROM admins WHERE username = $1 OR email = $2',
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
    const { error, value } = programSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    // Get facility_id
    const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityId.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }

    // If categoryId is provided, use it; otherwise try to map from category enum
    let categoryId = value.categoryId
    if (!categoryId && value.category) {
      const categoryResult = await pool.query(
        'SELECT id FROM program_categories WHERE name = $1 LIMIT 1',
        [value.category]
      )
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id
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

    const result = await pool.query(`
      INSERT INTO program (
        facility_id,
        category,
        category_id,
        name,
        display_name,
        skill_level,
        level_id,
        age_min,
        age_max,
        description,
        skill_requirements,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING 
        id,
        category,
        category_id as "categoryId",
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
    `, [
      facilityId.rows[0].id,
      value.category || null,
      categoryId || null,
      value.name || value.displayName?.toUpperCase().replace(/\s+/g, '_') || 'CLASS',
      value.displayName,
      value.skillLevel || null,
      levelId || null,
      value.ageMin || null,
      value.ageMax || null,
      value.description || null,
      value.skillRequirements || null,
      value.isActive !== undefined ? value.isActive : true
    ])

    res.json({
      success: true,
      message: 'Program created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Create program error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1

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

    const result = await pool.query(`
      UPDATE program
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        category,
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
    `, values)

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

    const result = await pool.query(`
      UPDATE program 
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
        message: 'Program not found'
      })
    }

    res.json({
      success: true,
      message: archived ? 'Program archived successfully' : 'Program unarchived successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Archive program error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// ========== CATEGORY ENDPOINTS ==========

// Get all categories (admin endpoint)
app.get('/api/admin/categories', async (req, res) => {
  try {
    const { archived } = req.query
    let query = `
      SELECT 
        id,
        name,
        display_name as "displayName",
        description,
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

    const result = await pool.query(`
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
    `, [facilityId.rows[0].id, value.name.toUpperCase().replace(/\s+/g, '_'), value.displayName, value.description || null])

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
      UPDATE program_categories
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        name,
        display_name as "displayName",
        description,
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
      // Check if username already exists (excluding current admin)
      const existing = await pool.query(
        'SELECT id FROM admins WHERE username = $1 AND id != $2',
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  })
})

// Start server
const startServer = async () => {
  await initDatabase()
  
  // Only start the HTTP server if not running as a migration script
  if (process.env.RUN_MIGRATION_ONLY !== 'true') {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
      console.log(`📝 Registrations: http://localhost:${PORT}/api/registrations`)
      console.log(`📧 Newsletter: http://localhost:${PORT}/api/newsletter`)
    })
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
