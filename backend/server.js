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
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { initAnalyticsTables } from './analytics/initTables.js'
import { registerAnalyticsRoutes } from './analytics/registerRoutes.js'
import { initSchedulingTables } from './scheduling/initTables.js'
import { registerSchedulingRoutes } from './scheduling/registerRoutes.js'
import { registerProgramsAdminRoutes, registerProgramsPublicRoutes } from './programs/registerRoutes.js'
import { registerCampRegistrationRoutes } from './campRegistrations/registerRoutes.js'
import { applyRegistrationAttribution } from './analytics/adminHandlers.js'
import { initDbFeatureTables } from './dbfeatures/initTables.js'
import { registerSchoolsRoutes } from './schools/registerRoutes.js'
import { registerNotesRoutes } from './notes/registerRoutes.js'
import { registerDbQueryRoutes } from './dbQueries/registerRoutes.js'
import { appendStaffNote } from './notes/handlers.js'
import { setMemberSchools } from './schools/handlers.js'
import { isEmailConfigured, formatEmailError } from './email/sendEmail.js'
import { EMAIL_LAYOUT_VERSION } from './email/emailHtml.js'
import { API_BUILD_ID, API_FEATURES } from './buildInfo.js'
import {
  notifyWelcomeNewMember,
  notifyEnrollmentReceipt,
  notifyFamilyGuardiansNewMember,
} from './email/memberNotifications.js'
import { countActiveFamilyMembers } from './email/memberContact.js'
import { issueEmailVerification } from './email/emailVerificationService.js'
import { refreshMemberProfileComplete } from './members/createMemberStub.js'
import { registerDevMemberRoutes } from './members/devMemberRoutes.js'
import { DEV_TEST_FLAG } from './members/seedDevTestMembers.js'
import { initPlatformTables } from './platform/initTables.js'
import { registerPlatformRoutes } from './platform/registerRoutes.js'
import { registerFamilySignupRoutes, createPortalFamilyMember } from './platform/familySignup.js'
import { queryFamilyMemberEnrollments } from './platform/memberEnrollments.js'
import { listActiveFamilyMemberIds, syncFamilyMemberLinks } from './platform/familyMembers.js'
import { registerCoachPortalRoutes } from './platform/coachPortalRoutes.js'
import { ensureCoachClassAssignmentSchema } from './platform/coachRoster.js'
import { ensureCoachingNotificationSchema } from './platform/coachingSchemaEnsure.js'
import { generateTemporaryPassword, sendTemporaryPasswordEmail } from './scheduling/tempPasswordEmail.js'
import { logWarn, reportError } from './observability/logger.js'
import { startAccountInviteReminderScheduler } from './email/accountInviteReminderService.js'
import { registerEmailPool } from './email/emailDeliveryStore.js'
import { registerEmailUnsubscribeRoutes } from './email/marketingUnsubscribe.js'
import { resolveJwtSecret } from './auth/jwtSecret.js'

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

const JWT_SECRET = resolveJwtSecret()

const ensureProductionEnv = () => {
  if (process.env.NODE_ENV !== 'production') return
  const required = [
    'JWT_SECRET',
    'FRONTEND_URL',
  ]
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const hasDbParts = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every((key) => Boolean(process.env[key]))
  if (!hasDatabaseUrl && !hasDbParts) {
    throw new Error('Production database configuration is missing. Set DATABASE_URL or DB_* variables.')
  }
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variable(s): ${missing.join(', ')}`)
  }
}
ensureProductionEnv()

// The default master admin account is permanent: it cannot be deleted,
// deactivated, or stripped of master admin access. Override via env if the
// owner account email ever changes.
const DEFAULT_MASTER_EMAIL = (process.env.DEFAULT_MASTER_EMAIL || 'team.vortexathletics@gmail.com')
  .trim()
  .toLowerCase()

const app = express()
const PORT = process.env.PORT || 3001

// Render (and other reverse proxies) set X-Forwarded-For; required for express-rate-limit.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1)
}

// Sport / gymnastics frontends (keep in sync with src/config/stubSites.ts)
const SPORT_SITE_ORIGINS = [
  'https://vortex-gymnastics.com',
  'https://www.vortex-gymnastics.com',
  'https://vortex-lacross.com',
  'https://www.vortex-lacross.com',
  'https://vortex-conditioning.com',
  'https://www.vortex-conditioning.com',
  'https://vortex-football.com',
  'https://www.vortex-football.com',
  'https://vortex-basketball.com',
  'https://www.vortex-basketball.com',
  'https://vortex-track.com',
  'https://www.vortex-track.com',
  'https://vortex-fit.com',
  'https://www.vortex-fit.com',
  'https://vortex-athlete.com',
  'https://www.vortex-athlete.com',
  'https://vortex-soccer.com',
  'https://www.vortex-soccer.com',
  'https://vortex-reps.com',
  'https://www.vortex-reps.com',
]

// CORS configuration - must be before helmet
const allowedOrigins = [
  'http://localhost:5173',
  'https://vortexathletics.com',
  'https://www.vortexathletics.com',
  ...SPORT_SITE_ORIGINS,
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

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
})

app.use(express.json({ limit: '10mb' }))

// Rate limiting — higher cap in dev (React Strict Mode doubles effect fetches).
const isProduction = process.env.NODE_ENV === 'production'
const apiRateLimitMax =
  Number(process.env.API_RATE_LIMIT_MAX) || (isProduction ? 1000 : 5000)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiRateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.method === 'OPTIONS',
})
app.use('/api/', limiter)
console.log(`🛡️ API rate limit: ${apiRateLimitMax} requests / 15 min`)

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

async function isDefaultMasterUserById(userId) {
  if (!userId) return false
  const result = await pool.query(`SELECT LOWER(email) AS email FROM app_user WHERE id = $1`, [userId])
  return result.rows[0]?.email === DEFAULT_MASTER_EMAIL
}

async function isDefaultMasterMemberId(memberId) {
  const result = await pool.query(
    `
      SELECT LOWER(COALESCE(au.email, m.email)) AS email, m.app_user_id
      FROM member m
      LEFT JOIN app_user au ON au.id = m.app_user_id
      WHERE m.id = $1
    `,
    [memberId],
  )
  if (result.rows.length === 0) return false
  const row = result.rows[0]
  if (row.email === DEFAULT_MASTER_EMAIL) return true
  if (row.app_user_id) return isDefaultMasterUserById(row.app_user_id)
  return false
}

// Initialize database tables
export const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

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
        interests_array TEXT[],
        interest VARCHAR(100),
        class_types TEXT[],
        child_ages INTEGER[],
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Add new columns if they don't exist (for existing databases)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interest VARCHAR(100)
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interests_array TEXT[]
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS class_types TEXT[]
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS child_ages INTEGER[]
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS campers JSONB
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submitter_role VARCHAR(50)
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS inquiry_source VARCHAR(500)
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT FALSE
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_notes TEXT
    `)
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS follow_up BOOLEAN DEFAULT FALSE
    `)

    await initAnalyticsTables(pool)
    await initSchedulingTables(pool)

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

    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS scheduling_form_id BIGINT REFERENCES scheduling_form(id) ON DELETE SET NULL
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_scheduling_form_id ON events(scheduling_form_id)
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
    // Legacy members and member_children table indexes removed - these tables no longer exist
    // Indexes are now managed by the unified member table (migration 005)
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

    // Highlights table (admin-managed site popups)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS highlights (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('event', 'document', 'custom')),
        event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
        document_mime VARCHAR(100),
        document_data TEXT,
        custom_content JSONB,
        site_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
        display_frequency VARCHAR(20) NOT NULL DEFAULT 'first_visit'
          CHECK (display_frequency IN ('first_visit', 'every_visit', 'daily', 'weekly', 'never')),
        published BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        button_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        button_label VARCHAR(100),
        button_url TEXT,
        button_text_above TEXT,
        button_text_below TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS button_enabled BOOLEAN NOT NULL DEFAULT FALSE
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS button_label VARCHAR(100)
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS button_url TEXT
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS button_text_above TEXT
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS button_text_below TEXT
    `)
    await pool.query(`
      ALTER TABLE highlights ADD COLUMN IF NOT EXISTS modal_height_px INTEGER NOT NULL DEFAULT 881
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_highlights_published ON highlights(published)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_highlights_sort_order ON highlights(sort_order)
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
    
    // Create user_role enum if it doesn't exist.
    // The consolidated role model is MASTER_ADMIN / ADMIN / COACH / MEMBER_ATHLETE
    // (see migration 032). On a brand-new database the historical migrations
    // (001+) may still seed legacy labels before 032 collapses them, so the
    // bootstrap enum is created as the superset and migration 032 narrows it.
    // We intentionally do NOT re-add legacy values to an existing enum here,
    // otherwise the consolidation in 032 would be undone on every boot.
    const typeExists = await pool.query(`
      SELECT 1 FROM pg_type WHERE typname = 'user_role'
    `)
    if (typeExists.rows.length === 0) {
      await pool.query(`
        CREATE TYPE user_role AS ENUM (
          'MASTER_ADMIN', 'ADMIN', 'COACH', 'MEMBER_ATHLETE',
          'PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE', 'MEMBER'
        )
      `)
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
        email               TEXT,
        phone               TEXT,
        full_name           TEXT NOT NULL,
        password_hash       TEXT,
        address             TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    // Ensure address column exists (for existing databases)
    await pool.query('ALTER TABLE app_user ADD COLUMN IF NOT EXISTS address TEXT')
    await pool.query('ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL')
    await pool.query('ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_facility_id_email_key')
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_user_facility_email_unique
      ON app_user (facility_id, email)
      WHERE email IS NOT NULL
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_facility_role ON app_user(facility_id, role)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_active ON app_user(is_active)`)

    // Create app_user_role junction table for multiple roles per user
    // Note: Named app_user_role to avoid conflict with user_role enum type
    // First, migrate old table name if it exists
    try {
      await pool.query(`ALTER TABLE user_role RENAME TO app_user_role`)
      console.log('✅ Migrated user_role table to app_user_role')
    } catch (renameError) {
      // Table doesn't exist or already renamed, that's fine
      if (renameError.code !== '42P01' && !renameError.message.includes('does not exist')) {
        console.log('Note: Could not rename user_role table (may not exist):', renameError.message)
      }
    }
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_user_role (
        id                  BIGSERIAL PRIMARY KEY,
        user_id             BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        role                user_role NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, role)
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_role_user_id ON app_user_role(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_app_user_role_role ON app_user_role(role)`)
    
    // Migrate existing single roles to app_user_role table
    await pool.query(`
      INSERT INTO app_user_role (user_id, role, created_at)
      SELECT id, role, created_at
      FROM app_user
      WHERE NOT EXISTS (
        SELECT 1 FROM app_user_role ur WHERE ur.user_id = app_user.id AND ur.role = app_user.role
      )
    `)

    // Migrate existing legacy admins into app_user as MASTER_ADMIN.
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
        'MASTER_ADMIN'::user_role as role,
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

    await ensureProgramCategoriesSchema()

    // ============================================================
    // MODULE 2: Unified Member Table (replaces app_user and athlete)
    // ============================================================
    
    // Create unified member table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        -- FK added after family table exists (see below)
        family_id           BIGINT,
        
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
        medical_concerns    TEXT,
        internal_flags      TEXT,
        
        -- Personal information
        gender              TEXT,
        
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
    await pool.query(`
      ALTER TABLE member
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS medical_concerns TEXT,
      ADD COLUMN IF NOT EXISTS injury_history_date DATE,
      ADD COLUMN IF NOT EXISTS injury_history_body_part TEXT,
      ADD COLUMN IF NOT EXISTS injury_history_notes TEXT,
      ADD COLUMN IF NOT EXISTS no_injury_history BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS experience TEXT,
      ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS signup_source VARCHAR(32)
    `)
    
    // Add unique constraint for email (only when email is not null)
    // Use CREATE INDEX IF NOT EXISTS (PostgreSQL 9.5+)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS member_facility_email_unique 
      ON member(facility_id, email) 
      WHERE email IS NOT NULL
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

    // Add member -> family FK after both tables exist.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'member_family_id_fkey'
        ) THEN
          ALTER TABLE member
          ADD CONSTRAINT member_family_id_fkey
          FOREIGN KEY (family_id)
          REFERENCES family(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `)
    
    // Migrate existing data: Add new columns if they don't exist (must be before index creation)
    await pool.query(`
      ALTER TABLE family 
      ADD COLUMN IF NOT EXISTS family_username TEXT,
      ADD COLUMN IF NOT EXISTS family_password_hash TEXT
    `)
    
    // Try to add unique constraint, but ignore if it already exists or column doesn't exist
    try {
      const constraintCheck = await pool.query(`
        SELECT 1 FROM pg_constraint WHERE conname = 'family_family_username_key'
      `)
      if (constraintCheck.rows.length === 0) {
        try {
          await pool.query(`ALTER TABLE family ADD CONSTRAINT family_family_username_key UNIQUE (family_username)`)
        } catch (addConstraintError) {
          // Constraint might fail if column doesn't exist or constraint exists in different form
          console.warn('[initDatabase] Could not add unique constraint on family_username (may already exist):', addConstraintError.message)
        }
      }
    } catch (checkError) {
      // Ignore constraint check errors
      console.warn('[initDatabase] Could not check unique constraint on family_username:', checkError.message)
    }
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_facility ON family(facility_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_name ON family(family_name)`)
    
    // Create index on family_username (will fail gracefully if column doesn't exist)
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_family_username ON family(family_username) WHERE family_username IS NOT NULL`)
    } catch (indexError) {
      // Column might not exist, log warning and continue - this is non-fatal
      console.warn('[initDatabase] Could not create index on family_username (column may not exist):', indexError.message)
    }

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
    // Legacy installs created emergency_contact with athlete_id only (migration 003).
    await pool.query(`
      ALTER TABLE emergency_contact
      ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE CASCADE
    `)
    await pool.query(`
      ALTER TABLE emergency_contact
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `)
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_emergency_contact_member ON emergency_contact(member_id)`)
    } catch (indexError) {
      console.warn('[initDatabase] Could not create index on emergency_contact.member_id (column may not exist):', indexError.message)
    }

    await initPlatformTables(pool)
    
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
  interests: Joi.alternatives().try(
    Joi.array().items(Joi.string().max(100)), // New multi-select interests (array of strings) - checked first
    Joi.string().max(500) // Legacy field for backward compatibility (single string)
  ).optional().allow(null),
  interest: Joi.string().max(100).optional().allow('', null), // Legacy single interest selection
  classTypes: Joi.array().items(Joi.string().valid(
    'Adult Classes',
    'Youth Classes',
    'Camps',
    'Homeschool Program',
    'Child Classes',
    'Gymnastics Summer Camp',
    'Summer Athletic Development Program',
  )).optional().allow(null),
  childAges: Joi.array().items(Joi.number().integer().min(1).max(18)).optional().allow(null),
  campers: Joi.array().items(Joi.object({
    firstName: Joi.string().min(1).max(50).optional().allow('', null),
    lastName: Joi.string().min(1).max(50).optional().allow('', null),
    dateOfBirth: Joi.string().isoDate().required(),
  })).optional().allow(null),
  submitterRole: Joi.string().valid('Athlete', 'Parent/Guardian', 'Other').optional().allow('', null),
  inquirySource: Joi.string().max(500).optional().allow('', null),
  message: Joi.string().max(1000).optional().allow('', null),
  newsletter: Joi.boolean().optional().allow(null).default(false),
  visitorId: Joi.string().max(64).optional().allow('', null),
  sessionId: Joi.string().max(64).optional().allow('', null),
  landingPage: Joi.string().max(500).optional().allow('', null),
  hostname: Joi.string().max(255).optional().allow('', null),
  utmSource: Joi.string().max(100).optional().allow('', null),
  utmMedium: Joi.string().max(100).optional().allow('', null),
  utmCampaign: Joi.string().max(100).optional().allow('', null),
  utmContent: Joi.string().max(100).optional().allow('', null),
  utmTerm: Joi.string().max(100).optional().allow('', null),
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

const memberPasswordResetRequestSchema = Joi.object({
  email: Joi.string().email().required(),
})

const memberChangePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
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
  tagVolunteers: Joi.boolean().optional().default(false),
  schedulingFormId: Joi.number().integer().positive().optional().allow(null),
})

const HIGHLIGHT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

const highlightCanvasSchema = Joi.object({
  width: Joi.number().integer().min(200).max(2000).required(),
  height: Joi.number().integer().min(200).max(2000).required(),
  backgroundColor: Joi.string().max(50).required(),
  elements: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('text', 'image', 'shape').required(),
    x: Joi.number().required(),
    y: Joi.number().required(),
    w: Joi.number().required(),
    h: Joi.number().required(),
    zIndex: Joi.number().integer().required(),
    text: Joi.string().max(10000).optional(),
    fontSize: Joi.number().optional(),
    color: Joi.string().max(50).optional(),
    backgroundColor: Joi.string().max(50).optional(),
    borderColor: Joi.string().max(50).optional(),
    borderWidth: Joi.number().optional(),
    src: Joi.string().max(15_000_000).optional(),
    shape: Joi.string().valid('rect', 'circle', 'line').optional(),
    fill: Joi.string().max(50).optional(),
    stroke: Joi.string().max(50).optional(),
    strokeWidth: Joi.number().optional(),
    lineOrientation: Joi.string().valid('horizontal', 'vertical').optional(),
  })).required(),
})

const highlightSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  contentType: Joi.string().valid('event', 'document', 'custom').required(),
  eventId: Joi.number().integer().optional().allow(null),
  documentMime: Joi.string().valid('application/pdf', 'image/png', 'image/jpeg', 'image/webp').optional().allow(null),
  documentData: Joi.string().max(15_000_000).optional().allow(null, ''),
  customContent: highlightCanvasSchema.optional().allow(null),
  siteKeys: Joi.array().items(Joi.string().min(1).max(50)).min(1).required(),
  displayFrequency: Joi.string().valid('first_visit', 'every_visit', 'daily', 'weekly', 'never').required(),
  published: Joi.boolean().optional().default(false),
  sortOrder: Joi.number().integer().optional().default(0),
  buttonEnabled: Joi.boolean().optional().default(false),
  buttonLabel: Joi.string().max(100).optional().allow(null, ''),
  buttonUrl: Joi.string().max(2000).optional().allow(null, ''),
  buttonTextAbove: Joi.string().max(5000).optional().allow(null, ''),
  buttonTextBelow: Joi.string().max(5000).optional().allow(null, ''),
})

const highlightUpdateSchema = highlightSchema.fork(
  ['title', 'contentType', 'siteKeys', 'displayFrequency'],
  (field) => field.optional(),
)

const highlightReorderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    id: Joi.number().integer().required(),
    sortOrder: Joi.number().integer().required(),
  })).min(1).required(),
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
  programsId: Joi.number().integer().optional().allow(null),
  skillLevel: Joi.string().valid('EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED').optional().allow(null, ''),
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
  description: Joi.string().max(1000).optional().allow('', null),
  primarySportId: Joi.number().integer().allow(null).optional(),
  pricingMaxSlotsPerUser: Joi.number().integer().min(1).allow(null).optional(),
  pricingSlotCostMonthlyCents: Joi.number().integer().min(0).optional(),
  pricingFreeSlotsPerUser: Joi.number().integer().min(0).optional(),
  pricingMaxFreeSlotsTotal: Joi.number().integer().min(0).allow(null).optional(),
})

const categoryUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  displayName: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional().allow('', null),
  archived: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  primarySportId: Joi.number().integer().allow(null).optional(),
  pricingMaxSlotsPerUser: Joi.number().integer().min(1).allow(null).optional(),
  pricingSlotCostMonthlyCents: Joi.number().integer().min(0).optional(),
  pricingFreeSlotsPerUser: Joi.number().integer().min(0).optional(),
  pricingMaxFreeSlotsTotal: Joi.number().integer().min(0).allow(null).optional(),
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
// Family creation schema - simplified, requires username and password
const familySchema = Joi.object({
  familyName: Joi.string().max(255).required(),
  familyUsername: Joi.string().min(3).max(50).required(),
  familyPassword: Joi.string().min(6).required(),
  facilityId: Joi.number().integer().optional().allow(null)
})

// Member creation schema - simplified, all members are equal
const memberSchema = Joi.object({
  // Family options (one of these must be provided):
  // Option 1: Create new family (must provide familyName, familyUsername, familyPassword)
  // Option 2: Join existing family (must provide familyId OR familyUsername + familyPassword)
  // Option 3: No family (familyId: null) - creates orphan member
  familyId: Joi.number().integer().optional().allow(null),
  familyUsername: Joi.string().optional().allow(null, ''),
  familyPassword: Joi.string().optional().allow(null, ''), // Required if joining existing family or creating new
  familyName: Joi.string().max(100).optional().allow(null, ''), // Required if creating new family
  
  // Member details
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().optional().allow(null, ''), // Optional for children
  phone: Joi.string().optional().allow(null, ''),
  dateOfBirth: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null).custom((value, helpers) => {
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
  
  // Parent/Guardian IDs (required for children < 18, must be array of adult member IDs)
  parentGuardianIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
  
  // Waiver status
  hasCompletedWaivers: Joi.boolean().optional().default(false),
  waiverCompletionDate: Joi.date().optional().allow(null),
  
  // Medical and internal notes
  medicalNotes: Joi.string().max(2000).optional().allow('', null),
  medicalConcerns: Joi.string().max(2000).optional().allow('', null),
  internalFlags: Joi.string().max(500).optional().allow('', null),
  
  // Personal information
  gender: Joi.string().max(50).optional().allow(null, ''),
  
  // Injury history
  injuryHistoryDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null).custom((value, helpers) => {
      if (!value || value.trim() === '') {
        return null
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return helpers.error('any.invalid', { message: 'injuryHistoryDate must be a valid date' })
      }
      return date
    })
  ).optional().allow(null, '').messages({
    'any.invalid': 'injuryHistoryDate must be a valid date'
  }),
  injuryHistoryBodyPart: Joi.string().max(200).optional().allow('', null),
  injuryHistoryNotes: Joi.string().max(2000).optional().allow('', null),
  noInjuryHistory: Joi.boolean().optional().default(false),
  
  // Experience
  experience: Joi.string().max(5000).optional().allow('', null),
  
  // Address
  address: Joi.string().max(500).optional().allow(null, ''),
  billingStreet: Joi.string().max(200).optional().allow(null, ''),
  billingCity: Joi.string().max(100).optional().allow(null, ''),
  billingState: Joi.string().max(50).optional().allow(null, ''),
  billingZip: Joi.string().max(20).optional().allow(null, ''),
  
  // Authentication (optional - children don't need login)
  username: Joi.string().max(50).optional().allow(null, ''),
  password: Joi.string().min(6).optional().allow(null, ''),
  
  // Parent/Guardian relationships (array of objects with id, relationship, relationshipOther)
  parentGuardians: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().required(),
      relationship: Joi.string().max(100).optional().allow('', null),
      relationshipOther: Joi.string().max(200).optional().allow('', null)
    })
  ).optional().allow(null)
}).custom((value, helpers) => {
  // Validation: If child (< 18), must have parentGuardianIds
  if (value.dateOfBirth) {
    const birthDate = new Date(value.dateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear() - 
      (today.getMonth() < birthDate.getMonth() || 
       (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
    
    if (age < 18 && (!value.parentGuardianIds || value.parentGuardianIds.length === 0)) {
      return helpers.error('any.custom', { message: 'Children under 18 must have at least one parent/guardian' })
    }
  }
  
  // Validation: If joining family by username, must provide password
  if (value.familyUsername && !value.familyId && !value.familyPassword) {
    return helpers.error('any.custom', { message: 'Family password is required when joining by family username' })
  }
  
  // Validation: If creating new family (familyName is provided), must provide familyName, familyUsername, and familyPassword
  // If familyName is not provided and familyId is null, it's an orphan member (no family) - this is allowed
  if (!value.familyId && !value.familyUsername && value.familyName !== undefined && value.familyName !== null && value.familyName !== '') {
    // Creating new family - familyName is provided, so we need all family info
    if (!value.familyName || value.familyName.trim() === '') {
      return helpers.error('any.custom', { message: 'Family name is required when creating a new family' })
    }
    if (!value.familyUsername || value.familyUsername.trim() === '') {
      return helpers.error('any.custom', { message: 'Family username is required when creating a new family' })
    }
    if (!value.familyPassword || value.familyPassword.trim() === '') {
      return helpers.error('any.custom', { message: 'Family password is required when creating a new family' })
    }
  }
  
  return value
})

// Keep athleteSchema for backward compatibility (maps to memberSchema)
const athleteSchema = memberSchema

const memberUpdateSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email().optional().allow(null, ''),
  phone: Joi.string().optional().allow(null, ''),
  dateOfBirth: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null)
  ).optional().allow(null, ''),
  gender: Joi.string().max(50).optional().allow(null, ''),
  medicalConcerns: Joi.string().max(2000).optional().allow('', null),
  injuryHistoryDate: Joi.alternatives().try(
    Joi.date(),
    Joi.string().allow('', null).custom((value, helpers) => {
      if (!value || value.trim() === '') {
        return null
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return helpers.error('any.invalid', { message: 'injuryHistoryDate must be a valid date' })
      }
      return date
    })
  ).optional().allow(null, '').messages({
    'any.invalid': 'injuryHistoryDate must be a valid date'
  }),
  injuryHistoryBodyPart: Joi.string().max(200).optional().allow('', null),
  injuryHistoryNotes: Joi.string().max(2000).optional().allow('', null),
  noInjuryHistory: Joi.boolean().optional(),
  experience: Joi.string().max(5000).optional().allow('', null),
  username: Joi.string().max(50).optional().allow(null, ''),
  password: Joi.string().min(6).optional().allow(null, ''),
  parentGuardianIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
  parentGuardians: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().required(),
      relationship: Joi.string().max(100).optional().allow('', null),
      relationshipOther: Joi.string().max(200).optional().allow('', null)
    })
  ).optional().allow(null),
  hasCompletedWaivers: Joi.boolean().optional(),
  waiverCompletionDate: Joi.date().optional().allow(null),
  medicalNotes: Joi.string().max(2000).optional().allow(null, ''),
  medicalConcerns: Joi.string().max(2000).optional().allow(null, ''),
  gender: Joi.string().max(50).optional().allow(null, ''),
  internalFlags: Joi.string().max(500).optional().allow('', null),
  address: Joi.string().max(500).optional().allow(null, ''),
  billingStreet: Joi.string().max(200).optional().allow(null, ''),
  billingCity: Joi.string().max(100).optional().allow(null, ''),
  billingState: Joi.string().max(50).optional().allow(null, ''),
  billingZip: Joi.string().max(20).optional().allow(null, ''),
  schoolIds: Joi.array().items(Joi.number().integer()).optional().allow(null),
  schoolWriteIn: Joi.string().max(200).optional().allow('', null)
})

// Keep athleteUpdateSchema for backward compatibility
const athleteUpdateSchema = memberUpdateSchema

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
// Role System Overview (consolidated model, see migration 032):
// - MASTER_ADMIN: Super administrators with full access (can delete members).
// - ADMIN: Administrators with day-to-day management access (can archive,
//          but cannot permanently delete members).
// - COACH: Staff members who can manage classes and athletes.
// - MEMBER_ATHLETE: Members/athletes who manage their family account, enroll,
//          sign documents, and view their own athlete information.
//
// SIMPLIFIED MEMBER SYSTEM RULES:
// 1. All members are equal - no distinction between users/athletes at creation
// 2. Athlete status = has enrollment + completed waivers (status becomes 'athlete')
// 3. Status progression: 'legacy' (default) → 'enrolled' (has enrollment) → 'athlete' (enrolled + waivers)
// 4. Family is just a linking ID - all members in family are equal, no primary member
// 5. Family has username/password for joining
// 6. Children (<18) must have parent_guardian_ids (array of adult member IDs)
// 7. Members can only belong to 1 family at a time
// 8. To join family: need family password OR login as existing adult member
// ============================================================

// Helper function to calculate and update member athlete status
// Status: 'legacy' (default), 'enrolled' (has enrollment), 'athlete' (enrolled + waivers), 'archived'
const updateMemberAthleteStatus = async (memberId) => {
  try {
    // Check if member has enrollments
    let hasEnrollments = false
    try {
      const enrollmentCheck = await pool.query(`
        SELECT COUNT(*) as count FROM member_program WHERE member_id = $1
      `, [memberId])
      
      hasEnrollments = parseInt(enrollmentCheck.rows[0]?.count || '0') > 0
    } catch (enrollmentError) {
      // If member_program table doesn't exist, member has no enrollments
      console.warn('[updateMemberAthleteStatus] member_program table may not exist:', enrollmentError.message)
      hasEnrollments = false
    }
    
    // Get waiver status
    const memberCheck = await pool.query(`
      SELECT has_completed_waivers, status FROM member WHERE id = $1
    `, [memberId])
    
    if (memberCheck.rows.length === 0) return null
    
    const hasWaivers = memberCheck.rows[0].has_completed_waivers === true
    const currentStatus = memberCheck.rows[0].status
    
    // Calculate new status
    let newStatus = 'legacy' // default
    if (hasEnrollments && hasWaivers) {
      newStatus = 'athlete'
    } else if (hasEnrollments) {
      newStatus = 'enrolled'
    } else if (currentStatus === 'archived') {
      newStatus = 'archived' // preserve archived status
    } else {
      newStatus = 'legacy'
    }
    
    // Update status if changed
    if (newStatus !== currentStatus) {
      await pool.query(`
        UPDATE member SET status = $1, updated_at = NOW() WHERE id = $2
      `, [newStatus, memberId])
    }
    
    return newStatus
  } catch (error) {
    console.error('Error updating member athlete status:', error)
    return null
  }
}

// Helper function to check if member is adult (age >= 18)
const isAdult = (dateOfBirth) => {
  if (!dateOfBirth) return true // No DOB = assume adult
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear() - 
    (today.getMonth() < birthDate.getMonth() || 
     (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
  return age >= 18
}

// Helper function to generate unique family username
const generateFamilyUsername = async (familyName, facilityId = null) => {
  // Generate username from family name (sanitize and make unique)
  const baseUsername = familyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20)
  
  let username = baseUsername
  let counter = 1
  
  while (true) {
    const checkQuery = facilityId 
      ? `SELECT id FROM family WHERE family_username = $1 AND facility_id = $2`
      : `SELECT id FROM family WHERE family_username = $1`
    
    const params = facilityId ? [username, facilityId] : [username]
    const result = await pool.query(checkQuery, params)
    
    if (result.rows.length === 0) {
      return username // Username is available
    }
    
    username = `${baseUsername}${counter}`
    counter++
    
    // Safety check to prevent infinite loop
    if (counter > 1000) {
      // Use timestamp as fallback
      username = `${baseUsername}${Date.now()}`
      break
    }
  }
  
  return username
}

// Helper function to hash family password
const hashFamilyPassword = async (password) => {
  return await bcrypt.hash(password, 10)
}

// Helper function to verify family password
const verifyFamilyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash)
}

// Helper function to validate parent/guardian IDs (must be adults)
const validateParentGuardians = async (parentGuardianIds) => {
  if (!parentGuardianIds || parentGuardianIds.length === 0) {
    return { valid: false, error: 'At least one parent/guardian is required for children' }
  }
  
  try {
    const result = await pool.query(`
      SELECT id, date_of_birth, first_name, last_name 
      FROM member 
      WHERE id = ANY($1::bigint[])
    `, [parentGuardianIds])
    
    if (result.rows.length !== parentGuardianIds.length) {
      return { valid: false, error: 'One or more parent/guardian IDs not found' }
    }
    
    // Check all are adults
    for (const member of result.rows) {
      if (!isAdult(member.date_of_birth)) {
        return { 
          valid: false, 
          error: `${member.first_name} ${member.last_name} is not an adult (must be 18+)` 
        }
      }
    }
    
    return { valid: true, members: result.rows }
  } catch (error) {
    console.error('Error validating parent guardians:', error)
    return { valid: false, error: 'Error validating parent guardians' }
  }
}

// Helper function to get children of a member (reverse lookup)
const getMemberChildren = async (memberId) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, date_of_birth, email, phone
      FROM member
      WHERE $1 = ANY(parent_guardian_ids)
    `, [memberId])
    
    return result.rows
  } catch (error) {
    console.error('Error getting member children:', error)
    return []
  }
}

// Helper functions for role management (kept for backward compatibility)
const getUserRoles = async (userId) => {
  try {
    // Check if app_user_role table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_user_role'
      )
    `)
    
    const hasUserRoleTable = tableCheck.rows[0].exists
    
    if (hasUserRoleTable) {
      // Try querying app_user_role table first
  try {
    const result = await pool.query(`
      SELECT role FROM app_user_role WHERE user_id = $1
    `, [userId])
        if (result.rows.length > 0) {
    return result.rows.map(row => row.role)
        }
      } catch (userRoleError) {
        // If query fails, continue to fallback
        console.warn('Error querying app_user_role table:', userRoleError.message)
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

const getUserFamilyContext = async (userId, client = pool) => {
  const result = await client.query(`
    WITH linked_member AS (
      SELECT m.*
      FROM member m
      WHERE m.app_user_id = $1
         OR (m.app_user_id IS NULL AND m.id = $1)
      ORDER BY CASE WHEN m.app_user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    )
    SELECT
      f.id,
      f.facility_id,
      f.family_name,
      lm.id as current_member_id,
      fba.payer_member_id
    FROM linked_member lm
    LEFT JOIN family_member fm
      ON fm.member_id = lm.id
      AND fm.is_active = TRUE
    JOIN family f
      ON f.id = COALESCE(fm.family_id, lm.family_id)
      AND f.archived = FALSE
    LEFT JOIN family_billing_account fba
      ON fba.family_id = f.id
      AND fba.is_active = TRUE
    LIMIT 1
  `, [userId])
  return result.rows[0] ?? null
}

async function familyContextFromMemberRow(client, member) {
  if (!member?.family_id) return null
  const familyRow = await client.query(
    `
      SELECT id, facility_id, family_name
      FROM family
      WHERE id = $1 AND archived = FALSE
    `,
    [member.family_id],
  )
  if (familyRow.rows.length === 0) return null

  await client.query(
    `
      INSERT INTO family_member (family_id, member_id, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (family_id, member_id) DO UPDATE SET
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `,
    [member.family_id, member.id],
  )

  const payer = await client.query(
    `
      SELECT payer_member_id
      FROM family_billing_account
      WHERE family_id = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [member.family_id],
  )

  return {
    id: familyRow.rows[0].id,
    facility_id: familyRow.rows[0].facility_id,
    family_name: familyRow.rows[0].family_name,
    current_member_id: member.id,
    payer_member_id: payer.rows[0]?.payer_member_id ?? null,
  }
}

/** Create and link a family when a logged-in member has no family yet (solo signup / legacy account). */
const ensureUserFamilyContext = async (userId, client = pool) => {
  const existing = await getUserFamilyContext(userId, client)
  if (existing) {
    await syncFamilyMemberLinks(client, existing.id)
    return existing
  }

  const member = await getMemberForAppUser(userId, client)
  if (!member) return null

  const linkedFamily = await familyContextFromMemberRow(client, member)
  if (linkedFamily) return linkedFamily

  let facilityId = member.facility_id
  if (!facilityId) {
    const userResult = await client.query(
      'SELECT facility_id FROM app_user WHERE id = $1',
      [userId],
    )
    facilityId = userResult.rows[0]?.facility_id
  }
  if (!facilityId) return null

  const lastName = String(member.last_name || '').trim() || 'Member'
  const familyResult = await client.query(
    `
      INSERT INTO family (facility_id, family_name)
      VALUES ($1, $2)
      RETURNING id, facility_id, family_name
    `,
    [facilityId, `${lastName} Family`],
  )
  const family = familyResult.rows[0]

  await moveMemberToFamily(member.id, family.id, client)

  await client.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone, is_active
      )
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (family_id) DO UPDATE SET
        payer_member_id = COALESCE(family_billing_account.payer_member_id, EXCLUDED.payer_member_id),
        billing_email = COALESCE(family_billing_account.billing_email, EXCLUDED.billing_email),
        billing_phone = COALESCE(family_billing_account.billing_phone, EXCLUDED.billing_phone),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `,
    [family.id, member.id, member.email, member.phone],
  )

  return {
    id: family.id,
    facility_id: family.facility_id,
    family_name: family.family_name,
    current_member_id: member.id,
    payer_member_id: member.id,
  }
}

const getMemberForAppUser = async (userId, client = pool) => {
  const result = await client.query(`
    SELECT m.*
    FROM member m
    LEFT JOIN app_user au ON au.id = $1
    WHERE m.app_user_id = $1
       OR (m.app_user_id IS NULL AND m.id = $1)
       OR (
         m.app_user_id IS NULL
         AND au.email IS NOT NULL
         AND m.email = au.email
         AND m.facility_id = au.facility_id
       )
    ORDER BY CASE
      WHEN m.app_user_id = $1 THEN 0
      WHEN m.app_user_id IS NULL AND m.id = $1 THEN 1
      ELSE 2
    END
    LIMIT 1
  `, [userId])
  return result.rows[0] ?? null
}

const ensureMemberForAppUser = async (userId, client = pool) => {
  const userResult = await client.query(`
    SELECT id, facility_id, email, phone, full_name, username, address
    FROM app_user
    WHERE id = $1
  `, [userId])
  const user = userResult.rows[0]
  if (!user) return null

  const existingMember = await getMemberForAppUser(userId, client)
  const nameParts = String(user.full_name || '').trim().split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || 'Member'
  const lastName = nameParts.slice(1).join(' ') || 'User'

  if (existingMember) {
    const updateResult = await client.query(`
      UPDATE member
      SET app_user_id = COALESCE(app_user_id, $1),
          first_name = COALESCE(NULLIF(first_name, ''), $2),
          last_name = COALESCE(NULLIF(last_name, ''), $3),
          email = COALESCE(email, $4),
          phone = COALESCE(phone, $5),
          username = COALESCE(username, $6),
          address = COALESCE(address, $7),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [
      user.id,
      firstName,
      lastName,
      user.email || null,
      user.phone || null,
      user.username || null,
      user.address || null,
      existingMember.id,
    ])
    return updateResult.rows[0] ?? existingMember
  }

  const insertResult = await client.query(`
    INSERT INTO member (
      facility_id,
      app_user_id,
      first_name,
      last_name,
      email,
      phone,
      username,
      address,
      status,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'legacy', TRUE)
    RETURNING *
  `, [
    user.facility_id,
    user.id,
    firstName,
    lastName,
    user.email || null,
    user.phone || null,
    user.username || null,
    user.address || null,
  ])
  return insertResult.rows[0] ?? null
}

const getFamilyForMember = async (memberId, client = pool) => {
  const result = await client.query(`
    SELECT f.*
    FROM family_member fm
    JOIN family f ON f.id = fm.family_id
    WHERE fm.member_id = $1
      AND fm.is_active = TRUE
      AND f.archived = FALSE
    ORDER BY fm.joined_at DESC, f.id DESC
    LIMIT 1
  `, [memberId])
  return result.rows[0] ?? null
}

const getFamilyPayer = async (familyId, client = pool) => {
  const result = await client.query(`
    SELECT
      fba.*,
      m.first_name,
      m.last_name,
      m.email,
      m.phone
    FROM family_billing_account fba
    LEFT JOIN member m ON m.id = fba.payer_member_id
    WHERE fba.family_id = $1
      AND fba.is_active = TRUE
    LIMIT 1
  `, [familyId])
  return result.rows[0] ?? null
}

const deactivateFamilyMembershipsForAppUser = async (userId, client = pool) => {
  await client.query(`
    UPDATE family_member fm
    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    FROM member m
    WHERE fm.member_id = m.id
      AND m.app_user_id = $1
  `, [userId])

  await client.query(`
    UPDATE member
    SET family_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE app_user_id = $1
  `, [userId])
}

const moveMemberToFamily = async (memberId, familyId, client = pool) => {
  await client.query(`
    UPDATE family_member
    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE member_id = $1
      AND family_id <> $2
      AND is_active = TRUE
  `, [memberId, familyId])

  await client.query(`
    INSERT INTO family_member (family_id, member_id, is_active)
    VALUES ($1, $2, TRUE)
    ON CONFLICT (family_id, member_id) DO UPDATE
    SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
  `, [familyId, memberId])

  await client.query(`
    UPDATE member
    SET family_id = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [familyId, memberId])
}

const userHasFamilyAccess = async (userId, familyId) => {
  const context = await getUserFamilyContext(userId)
  return Boolean(context && Number(context.id) === Number(familyId))
}

const userHasRole = async (userId, role) => {
  const roles = await getUserRoles(userId)
  return roles.includes(role)
}

const userHasAnyRole = async (userId, roles) => {
  const userRoles = await getUserRoles(userId)
  return roles.some(role => userRoles.includes(role))
}

// Adult status is derived from the member's date of birth, not from a role
// (the legacy PARENT_GUARDIAN/ATHLETE roles were collapsed into MEMBER_ATHLETE).
// Accounts with an unknown DOB are treated as adults so existing logins are
// never locked out of family management.
const userIsAdult = async (userId) => {
  const member = await getMemberForAppUser(userId)
  if (!member || !member.date_of_birth) return true
  return isAdult(member.date_of_birth)
}

const addUserRole = async (userId, role) => {
  try {
    await pool.query(`
      INSERT INTO app_user_role (user_id, role)
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
    await pool.query('DELETE FROM app_user_role WHERE user_id = $1 AND role = $2::user_role', [userId, role])
    return true
  } catch (error) {
    console.error('Error removing user role:', error)
    return false
  }
}

const setUserRoles = async (userId, roles) => {
  try {
    // Remove all existing roles from junction table
    await pool.query('DELETE FROM app_user_role WHERE user_id = $1', [userId])
    // Add new roles
    for (const role of roles) {
      await pool.query(`
        INSERT INTO app_user_role (user_id, role)
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

const syncRoleProfiles = async (userId, roles, { isMasterAdmin = false } = {}) => {
  const normalizedRoles = roles.map((role) => String(role).toUpperCase())
  if (normalizedRoles.some((role) => ['MASTER_ADMIN', 'ADMIN'].includes(role))) {
    await pool.query(`
      INSERT INTO admin_profile (user_id, is_master_admin)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        is_master_admin = EXCLUDED.is_master_admin,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, isMasterAdmin || normalizedRoles.includes('MASTER_ADMIN')])
  } else {
    await pool.query(`DELETE FROM admin_profile WHERE user_id = $1`, [userId])
  }

  if (normalizedRoles.includes('COACH')) {
    await pool.query(`
      INSERT INTO coach_profile (user_id, is_active)
      VALUES ($1, TRUE)
      ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
    `, [userId])
  } else {
    await pool.query(`
      UPDATE coach_profile
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [userId])
  }
}

const hasAdminPermission = async (userId, permission) => {
  if (!userId) return false
  const roles = await getUserRoles(userId)
  if (roles.some((role) => role === 'MASTER_ADMIN')) return true

  const result = await pool.query(`
    WITH base_permissions AS (
      SELECT DISTINCT p.key
      FROM role r
      JOIN role_permission rp ON rp.role_id = r.id
      JOIN permission p ON p.id = rp.permission_id
      WHERE r.key = ANY($1::text[])
    ),
    overrides AS (
      SELECT p.key, apo.effect
      FROM app_user_permission_override apo
      JOIN permission p ON p.id = apo.permission_id
      WHERE apo.user_id = $2
    )
    SELECT
      EXISTS (SELECT 1 FROM base_permissions WHERE key = $3) as base_allowed,
      (SELECT effect FROM overrides WHERE key = $3 LIMIT 1) as override_effect
  `, [roles, userId, permission])

  const row = result.rows[0]
  if (row?.override_effect === 'deny') return false
  if (row?.override_effect === 'allow') return true
  return row?.base_allowed === true
}

const requireAdminPermission = (permission) => async (req, res, next) => {
  try {
    if (req.isMasterAdmin === true || await hasAdminPermission(req.adminId, permission)) return next()
    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` })
  } catch (error) {
    console.error('Admin permission check error:', error)
    return res.status(500).json({ success: false, message: 'Permission check failed' })
  }
}

const mapAdminAccountRow = (row) => {
  const nameParts = String(row.full_name || '').trim().split(/\s+/).filter(Boolean)
  return {
    id: Number(row.id),
    firstName: row.first_name || nameParts[0] || '',
    lastName: row.last_name || nameParts.slice(1).join(' ') || '',
    email: row.email,
    phone: row.phone || null,
    username: row.username || '',
    isMaster: row.is_master_admin === true || row.role === 'MASTER_ADMIN',
    roles: row.roles || [],
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Middleware to verify JWT token (member or admin)
// Admin authentication middleware - verifies admin has MASTER_ADMIN or ADMIN role
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]
  
  if (!token) {
    console.log('[ADMIN AUTH] No token provided in request to:', req.path)
    return res.status(401).json({ 
      success: false, 
      message: 'No authentication token provided. Admin access required.' 
    })
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // Get admin ID (support both old and new token formats)
    const adminId = decoded.adminId || decoded.userId
    
    if (!adminId) {
      console.log('[ADMIN AUTH] Token missing admin ID:', req.path)
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token: Admin ID not found' 
      })
    }
    
    // CRITICAL SECURITY: Verify admin exists and has MASTER_ADMIN or ADMIN role
    // IMPORTANT: This checks the SPECIFIC user's role only - NOT family relationships
    // Even if an admin is in a family, ONLY the admin user themselves can access admin portal
    // Family members (spouse, children, etc.) will NOT have access even if they share the same family
    
    // Check token email to determine which table to check first
    // If token has email, we can match more accurately
    const tokenEmail = decoded.email
    
    // First, try to find admin by ID AND email (if email is in token) for more accurate matching
    // This prevents ID collisions between app_user and admins tables
    if (tokenEmail) {
      // Try app_user table first (preferred)
      try {
        const appUserCheck = await pool.query(`
          SELECT 
            au.id, 
            au.email, 
            au.is_active, 
            au.role,
            au.facility_id,
            (
              au.role::text IN ('MASTER_ADMIN', 'ADMIN')
              OR COALESCE(ap.is_master_admin, false)
              OR EXISTS(
                SELECT 1 FROM app_user_role ur 
                WHERE ur.user_id = au.id 
                AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
              )
            ) as has_admin_role,
            COALESCE(ap.is_master_admin, false) as is_master_admin
          FROM app_user au
          LEFT JOIN admin_profile ap ON ap.user_id = au.id
          WHERE au.id = $1 AND au.email = $2
        `, [adminId, tokenEmail])
        
        if (appUserCheck.rows.length > 0) {
          const user = appUserCheck.rows[0]
          const isAdminUser = user.has_admin_role === true
          
          if (isAdminUser && user.is_active) {
            req.adminId = user.id
            req.adminEmail = user.email
            req.isAdmin = true
            req.isMasterAdmin = user.is_master_admin === true || user.role === 'MASTER_ADMIN'
            console.log('[ADMIN AUTH] Authenticated admin (app_user table, matched by ID and email):', { 
              adminId: user.id, 
              email: user.email,
              role: user.role,
              facilityId: user.facility_id
            })
            return next()
          }
        }
      } catch (appUserError) {
        console.error('[ADMIN AUTH] Error checking app_user table (ID+email):', appUserError.message)
      }
      
      // Try legacy admins table with ID and email match
      try {
        const adminCheck = await pool.query(`
          SELECT id, email, is_master
          FROM admins
          WHERE id = $1 AND email = $2
        `, [adminId, tokenEmail])
        
        if (adminCheck.rows.length > 0) {
          const admin = adminCheck.rows[0]
          req.adminId = admin.id
          req.adminEmail = admin.email
          req.isAdmin = true
          console.log('[ADMIN AUTH] Authenticated admin (legacy admins table, matched by ID and email):', { adminId: admin.id, email: admin.email })
          return next()
        }
      } catch (adminsError) {
        console.error('[ADMIN AUTH] Error checking admins table (ID+email):', adminsError.message)
      }
    }
    
    // Fallback: Check by ID only (for tokens without email)
    // Try app_user table first (preferred)
    try {
      const appUserCheck = await pool.query(`
        SELECT 
          au.id, 
          au.email, 
          au.is_active, 
          au.role,
          au.facility_id,
          (
            au.role::text IN ('MASTER_ADMIN', 'ADMIN')
            OR COALESCE(ap.is_master_admin, false)
            OR EXISTS(
              SELECT 1 FROM app_user_role ur 
              WHERE ur.user_id = au.id 
              AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
            )
          ) as has_admin_role,
          COALESCE(ap.is_master_admin, false) as is_master_admin
        FROM app_user au
        LEFT JOIN admin_profile ap ON ap.user_id = au.id
        WHERE au.id = $1
      `, [adminId])
      
      if (appUserCheck.rows.length > 0) {
        const user = appUserCheck.rows[0]
        const isAdminUser = user.has_admin_role === true
        
        if (!isAdminUser) {
          console.log('[ADMIN AUTH] Access denied: User does not have admin role:', { 
            userId: adminId, 
            role: user.role,
            hasAdminRole: user.has_admin_role,
            email: user.email
          })
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied: Admin privileges required. Only the specific admin user can access the admin portal, not family members.' 
          })
        }
        
        if (!user.is_active) {
          console.log('[ADMIN AUTH] Access denied: Admin account is inactive:', { userId: adminId, email: user.email })
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied: Admin account is inactive' 
          })
        }
        
        req.adminId = user.id
        req.adminEmail = user.email
        req.isAdmin = true
        req.isMasterAdmin = user.is_master_admin === true || user.role === 'MASTER_ADMIN'
        console.log('[ADMIN AUTH] Authenticated admin (app_user table, ID only):', { 
          adminId: user.id, 
          email: user.email,
          role: user.role,
          facilityId: user.facility_id
        })
        return next()
      }
    } catch (appUserError) {
      console.error('[ADMIN AUTH] Error checking app_user table (ID only):', appUserError.message)
      // Continue to fallback check
    }
    
    // Fallback: Check legacy admins table (for backward compatibility during migration)
    try {
      const adminCheck = await pool.query(`
        SELECT id, email, is_master
        FROM admins
        WHERE id = $1
      `, [adminId])
      
      if (adminCheck.rows.length > 0) {
        const admin = adminCheck.rows[0]
        req.adminId = admin.id
        req.adminEmail = admin.email
        req.isAdmin = true
        console.log('[ADMIN AUTH] Authenticated admin (legacy admins table, ID only):', { adminId: admin.id, email: admin.email })
        return next()
      }
    } catch (adminsError) {
      console.error('[ADMIN AUTH] Error checking admins table (ID only):', adminsError.message)
    }
    
    console.log('[ADMIN AUTH] Admin not found in app_user or admins table:', { adminId })
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token: Admin account not found' 
    })
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('[ADMIN AUTH] Invalid JWT token:', req.path)
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authentication token' 
      })
    }
    if (error.name === 'TokenExpiredError') {
      console.log('[ADMIN AUTH] Expired JWT token:', req.path)
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token has expired' 
      })
    }
    
    console.error('[ADMIN AUTH] Authentication error:', {
      error: error.message,
      errorName: error.name,
      path: req.path,
      tokenLength: token?.length
    })
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    })
  }
}

// Member authentication middleware (for member portal, not admin)
const authenticateMember = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]
  
  if (!token) {
    console.log('[MEMBER AUTH] No token provided in request to:', req.path)
    return res.status(401).json({ success: false, message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    console.log('[MEMBER AUTH] Token decoded successfully:', { 
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
    console.log('[MEMBER AUTH] Authenticated:', { userId: req.userId, isAdmin: req.isAdmin })
    next()
  } catch (error) {
    console.error('[MEMBER AUTH] Token verification failed:', {
      error: error.message,
      errorName: error.name,
      path: req.path,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 20) + '...'
    })
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

// ============================================================
// Handle OPTIONS requests for CORS preflight (before authentication)
// ============================================================
// This MUST be before authentication middleware to handle preflight requests
app.options('*', (req, res) => {
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  res.sendStatus(204)
})

// ============================================================
// SECURITY: Apply admin authentication to all /api/admin routes
// ============================================================
// This middleware protects all admin routes except login and verification endpoints
// Note: When using app.use('/api/admin', ...), req.path is relative to the mount point
// So '/api/admin/login' becomes '/login' in req.path
function legacyAdminPermissionFor(req) {
  const path = req.path
  const method = req.method
  if (path.startsWith('/access')) return null
  if (path.startsWith('/admins')) return method === 'GET' && path === '/admins/me' ? null : 'admins.manage'
  if (path.startsWith('/members') || path.startsWith('/families') || path.startsWith('/users')) {
    if (method === 'GET') return 'members.view'
    if (path.includes('/archive')) return 'members.archive'
    // Permanently deleting a member is master-admin only (enforced again in the
    // route handler). Family delete keeps the legacy members.edit mapping.
    if (method === 'DELETE' && path.startsWith('/members')) return 'members.delete'
    return 'members.edit'
  }
  if (path.startsWith('/programs') || path.startsWith('/categories') || path.startsWith('/classes') || path.startsWith('/events') || path.startsWith('/highlights')) {
    return method === 'GET' ? 'classes.view' : 'classes.manage'
  }
  if (path.startsWith('/scheduling') || path.startsWith('/calendar') || path.startsWith('/signups') || path.startsWith('/waitlist')) {
    return method === 'GET' ? 'scheduling.view' : 'scheduling.manage'
  }
  if (path.startsWith('/pricing') || path.startsWith('/discount') || path.startsWith('/promo') || path.startsWith('/free-passes')) {
    return method === 'GET' ? 'pricing.view' : 'pricing.manage'
  }
  if (path.startsWith('/schools')) return method === 'GET' ? 'schools.view' : 'schools.manage'
  if (path.startsWith('/analytics')) return 'analytics.view'
  if (path.startsWith('/db-queries') || path.startsWith('/database') || path.startsWith('/create-member-program-table')) return 'admin_access.manage'
  if (path.startsWith('/email')) return 'admin_access.manage'
  return null
}

app.use('/api/admin', async (req, res, next) => {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next()
  }
  // Skip authentication for admin login endpoint
  if ((req.path === '/login' || req.originalUrl === '/api/admin/login') && req.method === 'POST') {
    return next()
  }
  // Skip authentication for module0 verification endpoint (used for setup/migration)
  if ((req.path === '/verify/module0' || req.originalUrl === '/api/admin/verify/module0') && req.method === 'GET') {
    return next()
  }
  // Apply admin authentication to all other admin routes
  return authenticateAdmin(req, res, async () => {
    const permission = legacyAdminPermissionFor(req)
    if (!permission || req.isMasterAdmin === true || await hasAdminPermission(req.adminId, permission)) return next()
    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` })
  })
})

// Analytics & consent (public + admin)
registerAnalyticsRoutes(app, pool)
registerSchedulingRoutes(app, pool)
registerProgramsPublicRoutes(app, pool)
registerProgramsAdminRoutes(app, pool)
registerPlatformRoutes(app, pool, { jwtSecret: JWT_SECRET })
registerFamilySignupRoutes(app, pool, { jwtSecret: JWT_SECRET })
registerEmailUnsubscribeRoutes(app)
registerCoachPortalRoutes(app, pool, { jwtSecret: JWT_SECRET })
registerCampRegistrationRoutes(app, pool)
registerDevMemberRoutes(app, pool)

// Create + email a single-use verification link for the logged-in user's email.
app.post('/api/members/email/send-verification', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId
    const userRes = await pool.query(
      `SELECT id, email, full_name, email_verified FROM app_user WHERE id = $1 AND is_active = TRUE`,
      [userId],
    )
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' })
    }
    const user = userRes.rows[0]
    const email = String(user.email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ success: false, message: 'No valid email on file for this account.' })
    }
    if (user.email_verified === true) {
      return res.json({ success: true, message: 'Email is already verified.', data: { alreadyVerified: true } })
    }
    if (!isEmailConfigured()) {
      return res.status(400).json({ success: false, message: formatEmailError(new Error('not configured')) })
    }

    try {
      await issueEmailVerification(pool, { userId: user.id, email, name: user.full_name })
      res.json({ success: true, message: `Verification email sent to ${email}` })
    } catch (err) {
      console.error('[verify-email] send failed:', err?.message || err)
      res.status(502).json({ success: false, message: err?.message || 'Failed to send verification email.' })
    }
  } catch (error) {
    console.error('[verify-email] send-verification error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Confirm an email verification token (public; link is the secret).
app.post('/api/verify-email/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ success: false, message: 'Token is required.' })

    const candidates = await pool.query(
      `SELECT * FROM email_verification_token
       WHERE used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 100`,
    )
    let match = null
    for (const row of candidates.rows) {
      if (await bcrypt.compare(token, row.token_hash)) {
        match = row
        break
      }
    }
    if (!match) {
      return res.status(404).json({ success: false, message: 'Verification link is invalid or expired.' })
    }

    await pool.query('BEGIN')
    try {
      await pool.query(
        `UPDATE app_user SET email_verified = TRUE, email_verified_at = now() WHERE id = $1`,
        [match.user_id],
      )
      await pool.query(`UPDATE email_verification_token SET used_at = now() WHERE id = $1`, [match.id])
      await pool.query('COMMIT')
    } catch (txErr) {
      await pool.query('ROLLBACK')
      throw txErr
    }

    res.json({ success: true, message: 'Email verified.', data: { email: match.email } })
  } catch (error) {
    console.error('[verify-email] confirm error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Schools, notes, and DB query builder (admin)
registerSchoolsRoutes(app, pool)
registerNotesRoutes(app, pool)
registerDbQueryRoutes(app, pool)

// Routes

const registeredRoutePaths = () => {
  const paths = new Set()
  if (!app._router?.stack) return paths
  for (const layer of app._router.stack) {
    if (layer.route?.path) {
      paths.add(layer.route.path)
    }
  }
  return paths
}

const hasRegisteredRoute = (path) => registeredRoutePaths().has(path)

// Health check
app.get('/api/health', async (req, res) => {
  let dbConnected = false
  let migrationsTable = false
  try {
    await pool.query('SELECT 1')
    dbConnected = true
    const migrationsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) as exists
    `)
    migrationsTable = migrationsCheck.rows[0]?.exists === true
  } catch (error) {
    dbConnected = false
  }

  const payload = {
    status: dbConnected ? 'OK' : 'DEGRADED',
    buildId: API_BUILD_ID,
    timestamp: new Date().toISOString(),
    emailConfigured: isEmailConfigured(),
    emailLayoutVersion: EMAIL_LAYOUT_VERSION,
    dbConnected,
    schemaMigrationsTracked: migrationsTable,
    apiFeatures: {
      highlights: hasRegisteredRoute('/api/admin/highlights'),
      publicHighlights: hasRegisteredRoute('/api/highlights'),
      scheduling: hasRegisteredRoute('/api/admin/scheduling/forms'),
      schedulingCalendar: hasRegisteredRoute('/api/admin/scheduling/calendar'),
      schedulingAdditionalFees: hasRegisteredRoute('/api/admin/scheduling/additional-fees'),
      schedulingFreePasses: hasRegisteredRoute('/api/admin/scheduling/free-passes'),
      schedulingBenefitSelections: hasRegisteredRoute('/api/admin/scheduling/pricing-benefit-selections'),
      memberPricingSummary: hasRegisteredRoute('/api/admin/scheduling/members/:memberId/pricing-summary'),
      publicScheduling: hasRegisteredRoute('/api/scheduling/forms'),
      dbQueries: hasRegisteredRoute('/api/admin/db-queries/entities'),
      schools: hasRegisteredRoute('/api/admin/schools'),
      notes: hasRegisteredRoute('/api/admin/notes'),
      adminEmailStatus: hasRegisteredRoute('/api/admin/email/status'),
      adminEmailTest: hasRegisteredRoute('/api/admin/email/test'),
      registrationInquiryOverhaul: true,
      schedulingEnrollSites: true,
      programPricingCostOptions: API_FEATURES.programPricingCostOptions === true,
      multiClassPassPackages: API_FEATURES.multiClassPassPackages === true,
      evergreenOfferings: API_FEATURES.evergreenOfferings === true,
    },
  }

  if (!dbConnected) {
    return res.status(503).json(payload)
  }
  res.json(payload)
})

// Test endpoint to verify routing works
app.get('/api/test-enrollment-route', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' })
  }
  console.log('[Test] Test enrollment route endpoint hit')
  res.json({ success: true, message: 'Enrollment route test - routing is working' })
})

// Module 0 verification endpoint
app.get('/api/verify/module0', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' })
  }
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
          SELECT COUNT(*) as count FROM app_user WHERE role::text IN ('MASTER_ADMIN', 'ADMIN')
        `)
        results.migratedAdmins.count = parseInt(adminCheck.rows[0].count)
        
        const adminSample = await pool.query(`
          SELECT id, email, full_name, role, is_active 
          FROM app_user 
          WHERE role::text IN ('MASTER_ADMIN', 'ADMIN') 
          LIMIT 5
        `)
        results.migratedAdmins.sample = adminSample.rows

        // Count members
        const memberCheck = await pool.query(`
          SELECT COUNT(*) as count FROM app_user WHERE role::text = 'MEMBER_ATHLETE'
        `)
        results.migratedMembers.count = parseInt(memberCheck.rows[0].count)
        
        const memberSample = await pool.query(`
          SELECT id, email, full_name, role, is_active 
          FROM app_user 
          WHERE role::text = 'MEMBER_ATHLETE' 
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
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' })
  }
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
    const { error, value } = registrationSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    })
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

    // Handle interests - can be array (new) or string (legacy)
    let interestsString = null
    let interestsArray = null
    if (value.interests) {
      if (Array.isArray(value.interests)) {
        // New multi-select format
        interestsArray = value.interests
        interestsString = value.interests.join(', ') // Also store as string for compatibility
      } else {
        // Legacy string format
        interestsString = value.interests
      }
    }

    const campersParam =
      value.campers && value.campers.length > 0
        ? JSON.stringify(
            value.campers.map((c) => {
              const row = {}
              if (c.firstName) row.firstName = c.firstName
              if (c.lastName) row.lastName = c.lastName
              if (c.dateOfBirth) {
                row.dateOfBirth = String(c.dateOfBirth).slice(0, 10)
              }
              return row
            }),
          )
        : null

    let submitterRole = value.submitterRole || null
    if (!submitterRole) {
      const campClassTypes = ['Camps', 'Gymnastics Summer Camp']
      const hasCampClass = value.classTypes?.some((t) => campClassTypes.includes(t))
      if (hasCampClass || value.inquirySource === '/camp_interest') {
        submitterRole = 'Parent/Guardian'
      }
    }

    try {
      const result = await pool.query(`
        INSERT INTO registrations 
        (first_name, last_name, email, phone, athlete_age, interests, interests_array, interest, class_types, child_ages, campers, message, submitter_role, inquiry_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
        RETURNING id, created_at
      `, [
        value.firstName,
        value.lastName,
        value.email,
        value.phone || null,
        value.athleteAge || null,
        interestsString,
        interestsArray,
        value.interest || null,
        value.classTypes && value.classTypes.length > 0 ? value.classTypes : null,
        value.childAges && value.childAges.length > 0 ? value.childAges : null,
        campersParam,
        value.message || null,
        submitterRole,
        value.inquirySource || null,
      ])

      const inquiryId = result.rows[0].id
      try {
        await applyRegistrationAttribution(pool, inquiryId, value)
      } catch (attrErr) {
        console.warn('[registrations] attribution attach failed:', attrErr.message)
      }

      console.log('✅ Registration inserted successfully:', {
        id: inquiryId,
        email: value.email,
        created_at: result.rows[0].created_at
      })

      res.json({
        success: true,
        message: 'Registration submitted successfully',
        id: inquiryId
      })
    } catch (insertError) {
      // If column doesn't exist error, try to add it and retry
      if (insertError.code === '42703' || (insertError.message && insertError.message.includes('column') && insertError.message.includes('does not exist'))) {
        console.log('⚠️ Missing column detected, attempting to add columns...')
        try {
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interests_array TEXT[]`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS interest VARCHAR(100)`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS class_types TEXT[]`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS child_ages INTEGER[]`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS campers JSONB`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submitter_role VARCHAR(50)`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS inquiry_source VARCHAR(500)`)
          await pool.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE`)
          
          // Retry the insert
          const result = await pool.query(`
            INSERT INTO registrations 
            (first_name, last_name, email, phone, athlete_age, interests, interests_array, interest, class_types, child_ages, campers, message, submitter_role, inquiry_source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
            RETURNING id, created_at
          `, [
            value.firstName,
            value.lastName,
            value.email,
            value.phone || null,
            value.athleteAge || null,
            interestsString,
            interestsArray,
            value.interest || null,
            value.classTypes && value.classTypes.length > 0 ? value.classTypes : null,
            value.childAges && value.childAges.length > 0 ? value.childAges : null,
            campersParam,
            value.message || null,
            submitterRole,
            value.inquirySource || null,
          ])
          
          const inquiryId = result.rows[0].id
          try {
            await applyRegistrationAttribution(pool, inquiryId, value)
          } catch (attrErr) {
            console.warn('[registrations] attribution attach failed:', attrErr.message)
          }

          console.log('✅ Registration inserted successfully after adding columns:', {
            id: inquiryId,
            email: value.email
          })
          
          res.json({
            success: true,
            message: 'Registration submitted successfully',
            id: inquiryId
          })
        } catch (retryError) {
          throw retryError // Re-throw to be caught by outer catch
        }
      } else {
        throw insertError // Re-throw other errors
      }
    }

  } catch (error) {
    console.error('Registration error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// ============================================================
// ADMIN ROUTES - All routes below require admin authentication
// ============================================================
// Note: All /api/admin/* routes are protected by authenticateAdmin middleware
// (applied via app.use() above). Login route is excluded in the middleware.

// Get registrations (admin endpoint)
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
    const {
      first_name,
      last_name,
      email,
      phone,
      athlete_age,
      interests,
      interests_array,
      interest,
      class_types,
      child_ages,
      message,
      submitter_role,
      inquiry_source,
      contacted,
      admin_notes,
      follow_up,
    } = req.body

    const existingResult = await pool.query(
      'SELECT contacted, admin_notes, follow_up FROM registrations WHERE id = $1',
      [id],
    )
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Registration not found' })
    }
    const existing = existingResult.rows[0]
    const finalContacted =
      contacted !== undefined ? !!contacted : !!existing.contacted
    const finalAdminNotes =
      admin_notes !== undefined ? admin_notes : existing.admin_notes
    const finalFollowUp =
      follow_up !== undefined ? !!follow_up : !!existing.follow_up
    const leadStatus = finalContacted ? 'contacted' : 'new'
    const setFirstContacted =
      finalContacted && !existing.contacted
        ? new Date()
        : null

    // Handle interests - can be array or string. Preserve interests_array when both
    // are supplied so saving notes/status doesn't wipe a multi-select selection.
    let interestsString = null
    let interestsArrayValue = null
    if (Array.isArray(interests)) {
      interestsArrayValue = interests
      interestsString = interests.join(', ')
    } else if (Array.isArray(interests_array)) {
      interestsArrayValue = interests_array
      interestsString =
        typeof interests === 'string' && interests.length > 0
          ? interests
          : interests_array.join(', ')
    } else if (typeof interests === 'string') {
      interestsString = interests
    }

    await pool.query(`
      UPDATE registrations 
      SET first_name = $1, last_name = $2, email = $3, phone = $4, athlete_age = $5, interests = $6, interests_array = $7, interest = $8, class_types = $9, child_ages = $10, message = $11, submitter_role = $12, inquiry_source = $13, contacted = $14, admin_notes = $15, lead_status = $16, first_contacted_at = COALESCE(first_contacted_at, $17), follow_up = $18, updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
    `, [
      first_name,
      last_name,
      email,
      phone,
      athlete_age,
      interestsString,
      interestsArrayValue,
      interest || null,
      class_types || null,
      child_ages || null,
      message,
      submitter_role ?? null,
      inquiry_source ?? null,
      finalContacted,
      finalAdminNotes,
      leadStatus,
      setFirstContacted,
      finalFollowUp,
      id,
    ])

    // Append an immutable staff note to the dated log when admin_notes changes.
    if (
      admin_notes !== undefined &&
      String(finalAdminNotes || '').trim() &&
      String(finalAdminNotes || '').trim() !== String(existing.admin_notes || '').trim()
    ) {
      try {
        await appendStaffNote(pool, req, 'registration', id, finalAdminNotes, 'inquiry_admin_notes')
      } catch (noteErr) {
        console.error('[notes] append staff note on registration PUT:', noteErr)
      }
    }

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
          m.medical_concerns,
          m.gender,
          m.injury_history_date,
          m.injury_history_body_part,
          m.injury_history_notes,
          m.no_injury_history,
          m.experience,
          m.internal_flags,
          m.status,
          m.is_active,
          m.family_is_active,
          COALESCE(fm.family_id, m.family_id) as family_id,
          m.username,
          m.has_completed_waivers,
          m.waiver_completion_date,
          m.created_at,
          m.updated_at,
          f.family_name,
          fba.payer_member_id,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age
        FROM member m
        LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
        LEFT JOIN family f ON f.id = COALESCE(fm.family_id, m.family_id)
        LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
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

      // Dev-only seed members are hidden in production
      if (process.env.NODE_ENV === 'production') {
        paramCount++
        query += ` AND (m.internal_flags IS NULL OR m.internal_flags <> $${paramCount})`
        params.push(DEV_TEST_FLAG)
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
      try {
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
      } catch (enrollmentsError) {
        // If member_program table doesn't exist, just continue with empty enrollments
        console.warn('[GET /api/admin/members] Error fetching enrollments (member_program table may not exist):', enrollmentsError.message)
        enrollmentsMap = {}
      }
    }
    
    // Get roles from canonical app_user/app_user_role records.
    let rolesMap = {}
    if (memberIds.length > 0) {
      try {
        const rolesResult = await pool.query(`
          SELECT
            m.id as member_id,
            json_agg(DISTINCT jsonb_build_object('id', role_key, 'role', role_key)) as roles
          FROM member m
          JOIN app_user au ON au.id = m.app_user_id
          CROSS JOIN LATERAL (
            SELECT au.role::text as role_key
            UNION
            SELECT aur.role::text as role_key
            FROM app_user_role aur
            WHERE aur.user_id = au.id
          ) roles
          WHERE m.id = ANY($1::bigint[])
          GROUP BY m.id
        `, [memberIds])

        rolesResult.rows.forEach(row => {
          rolesMap[row.member_id] = row.roles || []
        })
      } catch (rolesError) {
        console.warn('[GET /api/admin/members] Error fetching app_user roles:', rolesError.message)
      }
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
        medicalConcerns: row.medical_concerns,
        gender: row.gender,
        injuryHistoryDate: row.injury_history_date,
        injuryHistoryBodyPart: row.injury_history_body_part,
        injuryHistoryNotes: row.injury_history_notes,
        noInjuryHistory: row.no_injury_history || false,
        experience: row.experience,
        internalFlags: row.internal_flags,
        status: row.status,
        isActive: row.is_active,
        familyIsActive: row.family_is_active,
        familyId: row.family_id,
        familyName: row.family_name,
        payerMemberId: row.payer_member_id,
        isFamilyPayer: row.payer_member_id != null && Number(row.payer_member_id) === Number(row.id),
        username: row.username,
        hasCompletedWaivers: row.has_completed_waivers || false,
        waiverCompletionDate: row.waiver_completion_date,
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

// Fix missing app_user records for members (admin endpoint)
// This creates app_user records for members that have login credentials but are missing app_user records
app.post('/api/admin/members/fix-missing-app-users', async (req, res) => {
  try {
    console.log('[POST /api/admin/members/fix-missing-app-users] Fixing missing app_user records...')
    
    // Helper to check if person is adult (18+)
    function isAdult(dateOfBirth) {
      if (!dateOfBirth) return true
      const today = new Date()
      const birthDate = new Date(dateOfBirth)
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      return age >= 18
    }
    
    // First, get diagnostic info about all members
    const allMembersCheck = await pool.query(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.username,
        m.password_hash IS NOT NULL as has_password,
        EXISTS(SELECT 1 FROM app_user au WHERE au.id = m.id) as has_app_user
      FROM member m
      ORDER BY m.id
    `)
    
    // Find members that have email or username AND password_hash but no app_user record
    const membersResult = await pool.query(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.username,
        m.phone,
        m.password_hash,
        m.date_of_birth,
        m.is_active,
        m.facility_id,
        m.address
      FROM member m
      WHERE (m.email IS NOT NULL OR m.username IS NOT NULL)
        AND m.password_hash IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM app_user au WHERE au.id = m.id
        )
      ORDER BY m.id
    `)
    
    // Build diagnostic info
    const diagnostics = allMembersCheck.rows.map(m => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      email: m.email || null,
      username: m.username || null,
      hasPassword: m.has_password,
      hasAppUser: m.has_app_user,
      reason: !m.email && !m.username ? 'No email or username' :
              !m.has_password ? 'No password_hash' :
              m.has_app_user ? 'Already has app_user' :
              'Needs fix'
    }))
    
    if (membersResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No members found that need app_user records',
        fixed: 0,
        errors: 0,
        diagnostics: diagnostics
      })
    }
    
    // Get facility_id
    let facilityId = null
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length > 0) {
      facilityId = facilityResult.rows[0].id
    }
    
    let fixed = 0
    let errors = 0
    const errorsList = []
    
    for (const member of membersResult.rows) {
      try {
        const fullName = `${member.first_name} ${member.last_name}`.trim()
        const role = 'MEMBER_ATHLETE'
        
        // Check if app_user with this ID already exists (shouldn't happen, but check anyway)
        const existingCheck = await pool.query('SELECT id FROM app_user WHERE id = $1', [member.id])
        if (existingCheck.rows.length > 0) {
          console.log(`[Fix App Users] Member ${member.id} (${fullName}) already has app_user record, skipping`)
          continue
        }
        
        // Check if email/username conflict with existing app_user
        let conflictCheck = null
        if (member.email) {
          conflictCheck = await pool.query('SELECT id, email FROM app_user WHERE email = $1 AND id != $2', [member.email, member.id])
        } else if (member.username) {
          conflictCheck = await pool.query('SELECT id, username FROM app_user WHERE LOWER(username) = LOWER($1) AND id != $2', [member.username, member.id])
        }
        
        if (conflictCheck && conflictCheck.rows.length > 0) {
          const errorMsg = `Member ${member.id} (${fullName}) has email/username conflict with app_user ${conflictCheck.rows[0].id}`
          console.log(`[Fix App Users] ${errorMsg}`)
          errorsList.push(errorMsg)
          continue
        }
        
        // Create app_user record
        await pool.query(`
          INSERT INTO app_user (
            id, full_name, email, phone, username, password_hash,
            role, is_active, facility_id, address, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
          member.id,
          fullName,
          member.email || null,
          member.phone || null,
          member.username || null,
          member.password_hash,
          role,
          member.is_active,
          member.facility_id || facilityId,
          member.address || null
        ])
        
        console.log(`[Fix App Users] Created app_user for member ${member.id}: ${fullName} (${member.email || member.username}) - Role: ${role}`)
        fixed++
      } catch (error) {
        const errorMsg = `Error creating app_user for member ${member.id} (${member.first_name} ${member.last_name}): ${error.message}`
        console.error(`[Fix App Users] ${errorMsg}`)
        errorsList.push(errorMsg)
        errors++
      }
    }
    
    return res.json({
      success: true,
      message: `Fixed ${fixed} member(s), ${errors} error(s)`,
      fixed,
      errors,
      total: membersResult.rows.length,
      errorsList: errorsList.length > 0 ? errorsList : undefined,
      diagnostics: diagnostics
    })
  } catch (error) {
    console.error('[Fix App Users] Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get all athletes (admin endpoint) - backward compatibility wrapper for /api/admin/members
// This endpoint returns members in the format expected by legacy code that uses "athletes"
app.get('/api/admin/athletes', async (req, res) => {
  try {
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    
    if (!hasMemberTable) {
      // Return empty array if table doesn't exist yet
      return res.json({
        success: true,
        data: [],
        athletes: []
      })
    }
    
    // Check if family table exists (for the LEFT JOIN)
    const familyTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'family'
      )
    `)
    
    const hasFamilyTable = familyTableCheck.rows[0].exists
    
    // Query members - handle family table existence
    let membersResponse
    if (hasFamilyTable) {
      membersResponse = await pool.query(`
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.date_of_birth,
          m.medical_notes,
          m.internal_flags,
          m.family_id,
          CASE WHEN m.date_of_birth IS NOT NULL 
            THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
            ELSE NULL 
          END as age,
          f.family_name
        FROM member m
        LEFT JOIN family f ON m.family_id = f.id
        WHERE m.is_active = TRUE
        ORDER BY m.last_name, m.first_name
      `)
    } else {
      // If family table doesn't exist, query without the join
      membersResponse = await pool.query(`
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.date_of_birth,
          m.medical_notes,
          m.internal_flags,
          m.family_id,
          CASE WHEN m.date_of_birth IS NOT NULL 
            THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
            ELSE NULL 
          END as age,
          NULL as family_name
        FROM member m
        WHERE m.is_active = TRUE
        ORDER BY m.last_name, m.first_name
      `)
    }
    
    // Get enrollments for all members
    const memberIds = membersResponse.rows.map(row => row.id)
    let enrollmentsMap = {}
    
    if (memberIds.length > 0) {
      try {
        const enrollmentsResult = await pool.query(`
          SELECT 
            mp.member_id,
            json_agg(
              jsonb_build_object(
                'id', mp.id,
                'program_id', mp.program_id,
                'iteration_id', mp.iteration_id,
                'program_display_name', COALESCE(p.display_name, ''),
                'days_per_week', mp.days_per_week,
                'selected_days', mp.selected_days
              )
            ) as enrollments
          FROM member_program mp
          LEFT JOIN program p ON mp.program_id = p.id
          WHERE mp.member_id = ANY($1::bigint[])
          GROUP BY mp.member_id
        `, [memberIds])
        
        enrollmentsResult.rows.forEach(row => {
          enrollmentsMap[row.member_id] = row.enrollments || []
        })
      } catch (enrollmentsError) {
        // member_program table might not exist yet
        console.warn('Error fetching enrollments (table might not exist):', enrollmentsError.message)
      }
    }
    
    // Format as athletes (snake_case for backward compatibility)
    const athletes = membersResponse.rows.map(row => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      age: row.age ? parseInt(row.age) : null,
      medical_notes: row.medical_notes,
      internal_flags: row.internal_flags,
      family_id: row.family_id,
      // Note: member table doesn't have user_id - it's a unified table
      // user_id and linked_user_id removed (no longer needed)
      family_name: row.family_name,
      enrollments: enrollmentsMap[row.id] || []
    }))
    
    res.json({
      success: true,
      data: athletes,
      athletes: athletes // Also include as 'athletes' for backward compatibility
    })
  } catch (error) {
    console.error('Get athletes error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    })
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      } : undefined
    })
  }
})

// Get enrollments for a specific athlete (admin endpoint) - backward compatibility
app.get('/api/admin/athletes/:id/enrollments', async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if member_program table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member_program'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    const enrollmentsResult = await pool.query(`
      SELECT 
        mp.id,
        mp.program_id,
        mp.iteration_id,
        mp.days_per_week,
        mp.selected_days,
        p.display_name as program_display_name,
        p.name as program_name
      FROM member_program mp
      LEFT JOIN program p ON mp.program_id = p.id
      WHERE mp.member_id = $1
      ORDER BY mp.created_at DESC
    `, [id])
    
    const enrollments = enrollmentsResult.rows.map(e => ({
      id: e.id,
      program_id: e.program_id,
      iteration_id: e.iteration_id,
      days_per_week: e.days_per_week,
      selected_days: e.selected_days,
      program_display_name: e.program_display_name,
      program_name: e.program_name
    }))
    
    res.json({
      success: true,
      data: enrollments
    })
  } catch (error) {
    console.error('Get athlete enrollments error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get single athlete (admin endpoint) - backward compatibility
app.get('/api/admin/athletes/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      })
    }
    
    const memberResult = await pool.query(`
      SELECT 
        m.*,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        f.family_name
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      WHERE m.id = $1
    `, [id])
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      })
    }
    
    const member = memberResult.rows[0]
    
    // Format as athlete (snake_case for backward compatibility)
    res.json({
      success: true,
      data: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        date_of_birth: member.date_of_birth,
        age: member.age ? parseInt(member.age) : null,
        medical_notes: member.medical_notes,
        internal_flags: member.internal_flags,
        family_id: member.family_id,
        user_id: member.user_id,
        linked_user_id: member.user_id, // For backward compatibility
        family_name: member.family_name,
        created_at: member.created_at,
        updated_at: member.updated_at
      }
    })
  } catch (error) {
    console.error('Get athlete error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update athlete (admin endpoint) - backward compatibility wrapper for /api/admin/members/:id
app.put('/api/admin/athletes/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { firstName, lastName, dateOfBirth, medicalNotes, internalFlags } = req.body
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      })
    }
    
    // Check if member exists
    const memberCheck = await pool.query('SELECT id FROM member WHERE id = $1', [id])
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      })
    }
    
    // Update member
    const updateResult = await pool.query(`
      UPDATE member
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        date_of_birth = COALESCE($3, date_of_birth),
        medical_notes = COALESCE($4, medical_notes),
        internal_flags = COALESCE($5, internal_flags),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      firstName || null,
      lastName || null,
      dateOfBirth || null,
      medicalNotes || null,
      internalFlags || null,
      id
    ])
    
    const updatedMember = updateResult.rows[0]
    
    // Format response as athlete (snake_case for backward compatibility)
    res.json({
      success: true,
      data: {
        id: updatedMember.id,
        first_name: updatedMember.first_name,
        last_name: updatedMember.last_name,
        date_of_birth: updatedMember.date_of_birth,
        medical_notes: updatedMember.medical_notes,
        internal_flags: updatedMember.internal_flags,
        family_id: updatedMember.family_id,
        user_id: updatedMember.user_id,
        created_at: updatedMember.created_at,
        updated_at: updatedMember.updated_at
      }
    })
  } catch (error) {
    console.error('Update athlete error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create athlete (admin endpoint) - backward compatibility wrapper for /api/admin/members
app.post('/api/admin/athletes', async (req, res) => {
  try {
    const { familyId, firstName, lastName, dateOfBirth, medicalNotes, internalFlags, userId } = req.body
    
    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, and dateOfBirth are required'
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
    
    if (!tableCheck.rows[0].exists) {
      return res.status(500).json({
        success: false,
        message: 'Member table does not exist. Please run database migrations first.'
      })
    }
    
    // Check if family exists if familyId is provided
    if (familyId) {
      const familyCheck = await pool.query('SELECT id FROM family WHERE id = $1', [familyId])
      if (familyCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Family not found'
        })
      }
    }
    
    // Create member using the members endpoint logic
    const insertResult = await pool.query(`
      INSERT INTO member (
        first_name,
        last_name,
        date_of_birth,
        medical_notes,
        internal_flags,
        family_id,
        user_id,
        status,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      firstName,
      lastName,
      dateOfBirth,
      medicalNotes || null,
      internalFlags || null,
      familyId || null,
      userId || null,
      'legacy', // Default status
      true // is_active
    ])
    
    const newMember = insertResult.rows[0]
    
    // Update family_is_active for all family members if familyId is provided
    if (familyId) {
      await pool.query(`
        UPDATE member
        SET family_is_active = TRUE
        WHERE family_id = $1
      `, [familyId])
    }
    
    // Format response as athlete (snake_case for backward compatibility)
    res.json({
      success: true,
      data: {
        id: newMember.id,
        first_name: newMember.first_name,
        last_name: newMember.last_name,
        date_of_birth: newMember.date_of_birth,
        medical_notes: newMember.medical_notes,
        internal_flags: newMember.internal_flags,
        family_id: newMember.family_id,
        user_id: newMember.user_id,
        created_at: newMember.created_at,
        updated_at: newMember.updated_at
      }
    })
  } catch (error) {
    console.error('Create athlete error:', error)
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

    if (archived && (await isDefaultMasterMemberId(id))) {
      return res.status(400).json({
        success: false,
        message: 'The default master admin account cannot be archived.',
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
        m.id as member_id,
        f.id as family_id,
        f.family_name,
        fba.payer_member_id
      FROM app_user u
      LEFT JOIN member m ON m.app_user_id = u.id
      LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
      LEFT JOIN family f ON f.id = COALESCE(fm.family_id, m.family_id) AND f.archived = FALSE
      LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
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
    const userRoles = roles && Array.isArray(roles) ? roles : (role ? [role] : ['MEMBER_ATHLETE'])
    
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
            await deactivateFamilyMembershipsForAppUser(userId)
          }
          // For 'revive', we keep the existing family associations (do nothing)
          
          // Update user info and reactivate
          const primaryRole = userRoles[0] || 'MEMBER_ATHLETE'
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
          const linkedMember = await ensureMemberForAppUser(userId)
          
          // Fetch user with all roles
          const allRoles = await getUserRoles(userId)
          const updatedUser = await pool.query(`
            SELECT id, email, full_name, phone, role, is_active, created_at, username, address
            FROM app_user
            WHERE id = $1
          `, [userId])
          
          const userData = {
            ...updatedUser.rows[0],
            member_id: linkedMember?.id ?? null,
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
            await deactivateFamilyMembershipsForAppUser(userId)
          }
          // For 'revive', we keep the existing family associations (do nothing)
          
          // Update user info (keep is_active = true for active users)
          const primaryRole = userRoles[0] || 'MEMBER_ATHLETE'
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
          const linkedMember = await ensureMemberForAppUser(userId)
          
          // Fetch user with all roles
          const allRoles = await getUserRoles(userId)
          const updatedUser = await pool.query(`
            SELECT id, email, full_name, phone, role, is_active, created_at, username
            FROM app_user
            WHERE id = $1
          `, [userId])
          
          const userData = {
            ...updatedUser.rows[0],
            member_id: linkedMember?.id ?? null,
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
    const primaryRole = userRoles[0] || 'MEMBER_ATHLETE'
    const result = await pool.query(`
      INSERT INTO app_user (facility_id, role, email, phone, full_name, password_hash, is_active, username, address)
      VALUES ($1, $2::user_role, $3, $4, $5, $6, TRUE, $7, $8)
      RETURNING id, email, full_name, phone, role, is_active, created_at, username, address
    `, [facilityId, primaryRole, email || null, phone || null, fullName, passwordHash, username || null, address || null])

    const userId = result.rows[0].id

    // Add all roles to user_role table
    await setUserRoles(userId, userRoles)
    const linkedMember = await ensureMemberForAppUser(userId)

    // Fetch user with all roles
    const allRoles = await getUserRoles(userId)
    const userData = {
      ...result.rows[0],
      member_id: linkedMember?.id ?? null,
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
      ? "UPDATE member SET status = 'archived', is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE app_user_id = $1 OR (app_user_id IS NULL AND id = $1)"
      : `UPDATE member SET 
          status = CASE
            WHEN EXISTS (SELECT 1 FROM member_program WHERE member_id = member.id) 
            THEN 'enrolled'
            ELSE 'legacy'
          END,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
          WHERE app_user_id = $1 OR (app_user_id IS NULL AND id = $1)`
    
    await pool.query(memberStatusUpdate, [id])

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
        m.id as member_id,
        f.id as family_id,
        f.family_name,
        fba.payer_member_id
      FROM app_user u
      LEFT JOIN member m ON m.app_user_id = u.id
      LEFT JOIN family_member fm ON fm.member_id = m.id AND fm.is_active = TRUE
      LEFT JOIN family f ON f.id = COALESCE(fm.family_id, m.family_id) AND f.archived = FALSE
      LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
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
// Search for families by name or username (for joining)
app.get('/api/admin/families/search', async (req, res) => {
  try {
    const { search, familyUsername } = req.query
    
    if (!search && !familyUsername) {
      return res.status(400).json({
        success: false,
        message: 'Search term or family username is required'
      })
    }
    
    let query = `
      SELECT 
        f.id,
        f.family_name,
        f.family_username,
        f.created_at,
        COUNT(DISTINCT m.id) as member_count,
        fba.payer_member_id
      FROM family f
      LEFT JOIN family_member fm ON fm.family_id = f.id AND fm.is_active = TRUE
      LEFT JOIN member m ON m.id = fm.member_id AND m.is_active = TRUE
      LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
      WHERE f.archived = FALSE
    `
    
    const params = []
    let paramCount = 0
    
    if (familyUsername) {
      paramCount++
      query += ` AND f.family_username = $${paramCount}`
      params.push(familyUsername)
    } else if (search) {
      paramCount++
      query += ` AND (
        f.family_name ILIKE $${paramCount} OR 
        f.family_username ILIKE $${paramCount} OR
        EXISTS (
          SELECT 1
          FROM family_member fm_search
          JOIN member m_search ON m_search.id = fm_search.member_id
          WHERE fm_search.family_id = f.id
            AND fm_search.is_active = TRUE
            AND m_search.is_active = TRUE
            AND (
              m_search.first_name ILIKE $${paramCount}
              OR m_search.last_name ILIKE $${paramCount}
              OR CONCAT(m_search.first_name, ' ', m_search.last_name) ILIKE $${paramCount}
              OR m_search.email ILIKE $${paramCount}
            )
        )
      )`
      params.push(`%${search}%`)
    }
    
    query += ` GROUP BY f.id, f.family_name, f.family_username, f.created_at, fba.payer_member_id ORDER BY f.family_name LIMIT 20`
    
    const result = await pool.query(query, params)
    
    // Return families without password hash
    const families = result.rows.map(row => ({
      id: row.id,
      familyName: row.family_name,
      familyUsername: row.family_username,
      memberCount: parseInt(row.member_count || '0'),
      payerMemberId: row.payer_member_id,
      createdAt: row.created_at
    }))
    
    res.json({
      success: true,
      data: families
    })
  } catch (error) {
    console.error('Search families error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Join family by password (admin endpoint)
// Member must not already belong to another family
app.post('/api/admin/members/:memberId/join-family', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    const { memberId } = req.params
    const { familyId, familyUsername, familyPassword } = req.body
    
    if (!familyId && !familyUsername) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Family ID or family username is required'
      })
    }
    
    if (!familyPassword) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Family password is required'
      })
    }
    
    // Check if member exists and doesn't already belong to another family
    const memberCheck = await client.query(`
      SELECT id, first_name, last_name, family_id FROM member WHERE id = $1
    `, [memberId])
    
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const member = memberCheck.rows[0]
    
    // Check if member already belongs to an active family.
    const activeFamily = await getFamilyForMember(member.id, client)
    if (activeFamily) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Member already belongs to a family. Members can only belong to one family at a time.'
      })
    }
    
    // Find family
    let query = `SELECT id, family_name, family_username, family_password_hash FROM family WHERE archived = FALSE`
    const params = []
    let paramCount = 0
    
    if (familyId) {
      paramCount++
      query += ` AND id = $${paramCount}`
      params.push(familyId)
    } else if (familyUsername) {
      paramCount++
      query += ` AND family_username = $${paramCount}`
      params.push(familyUsername)
    }
    
    const familyResult = await client.query(query, params)
    
    if (familyResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    const family = familyResult.rows[0]
    
    // Verify password
    const passwordValid = await verifyFamilyPassword(familyPassword, family.family_password_hash)
    
    if (!passwordValid) {
      await client.query('ROLLBACK')
      return res.status(401).json({
        success: false,
        message: 'Invalid family password'
      })
    }
    
    await moveMemberToFamily(member.id, family.id, client)
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: `${member.first_name} ${member.last_name} has been added to ${family.family_name}`,
      data: {
        familyId: family.id,
        familyName: family.family_name,
        familyUsername: family.family_username
      }
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Join family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
  }
})

app.post('/api/admin/families/:familyId/members/:memberId/move', async (req, res) => {
  try {
    const { familyId, memberId } = req.params
    const targetFamilyId = Number(req.body?.targetFamilyId)
    if (!Number.isFinite(targetFamilyId)) {
      return res.status(400).json({ success: false, message: 'targetFamilyId is required' })
    }
    const targetFamily = await pool.query(`SELECT id FROM family WHERE id = $1 AND COALESCE(archived, false) = FALSE`, [targetFamilyId])
    if (targetFamily.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target family not found' })
    }
    const member = await pool.query(`
      SELECT 1 FROM family_member WHERE family_id = $1 AND member_id = $2 AND is_active = TRUE
    `, [familyId, memberId])
    if (member.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member is not active in source family' })
    }
    await moveMemberToFamily(Number(memberId), targetFamilyId)
    res.json({ success: true, data: { memberId: Number(memberId), familyId: targetFamilyId } })
  } catch (error) {
    console.error('Move family member error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Verify family password (for joining existing family)
app.post('/api/admin/families/verify', async (req, res) => {
  try {
    const { familyId, familyUsername, familyPassword } = req.body
    
    if (!familyPassword) {
      return res.status(400).json({
        success: false,
        message: 'Family password is required'
      })
    }
    
    let query = `SELECT id, family_name, family_username, family_password_hash FROM family WHERE archived = FALSE`
    const params = []
    let paramCount = 0
    
    if (familyId) {
      paramCount++
      query += ` AND id = $${paramCount}`
      params.push(familyId)
    } else if (familyUsername) {
      paramCount++
      query += ` AND family_username = $${paramCount}`
      params.push(familyUsername)
    } else {
      return res.status(400).json({
        success: false,
        message: 'Family ID or family username is required'
      })
    }
    
    const result = await pool.query(query, params)
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    const family = result.rows[0]
    
    // Verify password
    const passwordValid = await verifyFamilyPassword(familyPassword, family.family_password_hash)
    
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid family password'
      })
    }
    
    // Get member count
    const memberCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM member WHERE family_id = $1
    `, [family.id])
    
    res.json({
      success: true,
      data: {
        id: family.id,
        familyName: family.family_name,
        familyUsername: family.family_username,
        memberCount: parseInt(memberCountResult.rows[0]?.count || '0')
      }
    })
  } catch (error) {
    console.error('Verify family password error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get all families (admin endpoint) - simplified, no primary member concept
app.get('/api/admin/families', async (req, res) => {
  try {
    const { search } = req.query
    
    let query = `
      SELECT 
        f.id,
        f.facility_id,
        f.family_name,
        f.family_username,
        COALESCE(f.archived, FALSE) as archived,
        f.created_at,
        f.updated_at,
        fba.payer_member_id,
        COUNT(DISTINCT m.id) as member_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', m.id,
              'appUserId', m.app_user_id,
              'firstName', m.first_name,
              'lastName', m.last_name,
              'email', m.email,
              'phone', m.phone,
              'dateOfBirth', m.date_of_birth,
              'age', CASE WHEN m.date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER ELSE NULL END,
              'status', m.status,
              'isActive', m.is_active,
              'hasCompletedWaivers', m.has_completed_waivers
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as members
      FROM family f
      LEFT JOIN family_member fm ON fm.family_id = f.id AND fm.is_active = TRUE
      LEFT JOIN member m ON m.id = fm.member_id AND m.is_active = TRUE
      LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
      WHERE COALESCE(f.archived, FALSE) = FALSE
    `
    const params = []
    let paramCount = 0
    
    if (search) {
      paramCount++
      query += ` AND (
        f.family_name ILIKE $${paramCount} OR 
        f.family_username ILIKE $${paramCount} OR
        EXISTS (
          SELECT 1
          FROM family_member fm2
          JOIN member m2 ON m2.id = fm2.member_id
          WHERE fm2.family_id = f.id
          AND fm2.is_active = TRUE
          AND (m2.first_name ILIKE $${paramCount} OR m2.last_name ILIKE $${paramCount} OR m2.email ILIKE $${paramCount})
        )
      )`
      params.push(`%${search}%`)
    }
    
    query += ` GROUP BY f.id, f.facility_id, f.family_name, f.family_username, f.archived, f.created_at, f.updated_at, fba.payer_member_id ORDER BY f.family_name, f.created_at DESC`
    
    const result = await pool.query(query, params)
    
    const families = result.rows.map(row => ({
      id: row.id,
      facilityId: row.facility_id,
      familyName: row.family_name,
      familyUsername: row.family_username,
      archived: row.archived,
      payerMemberId: row.payer_member_id,
      billingAccount: {
        payerMemberId: row.payer_member_id,
      },
      memberCount: parseInt(row.member_count || '0'),
      members: row.members || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    res.json({
      success: true,
      data: families
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

// Get single family (admin endpoint) - simplified, no primary member concept
app.get('/api/admin/families/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const familyResult = await pool.query(`
      SELECT 
        f.id,
        f.facility_id,
        f.family_name,
        f.family_username,
        f.archived,
        f.created_at,
        f.updated_at
      FROM family f
      WHERE f.id = $1
    `, [id])
    
    if (familyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    const family = familyResult.rows[0]
    const billingAccount = await getFamilyPayer(id)
    
    // Get all members in this family (all are equal, no primary member)
    const membersResult = await pool.query(`
      SELECT 
        m.id,
        m.app_user_id,
        m.first_name,
        m.last_name,
        m.email,
        m.phone,
        m.username,
        m.date_of_birth,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        m.status,
        m.is_active,
        m.has_completed_waivers,
        m.parent_guardian_ids,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ec.id,
              'name', ec.name,
              'relationship', ec.relationship,
              'phone', ec.phone,
              'email', ec.email
            )
          ) FILTER (WHERE ec.id IS NOT NULL),
          '[]'
        ) as emergency_contacts
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      LEFT JOIN emergency_contact ec ON m.id = ec.member_id
      WHERE fm.family_id = $1
        AND fm.is_active = TRUE
        AND m.is_active = TRUE
      GROUP BY m.id, m.first_name, m.last_name, m.email, m.phone, m.username, 
               m.app_user_id, m.date_of_birth, m.status, m.is_active, m.has_completed_waivers, m.parent_guardian_ids
      ORDER BY m.date_of_birth NULLS LAST, m.last_name, m.first_name
    `, [id])
    
    // Format members with parent guardians info
    const members = membersResult.rows.map(member => {
      const memberData = {
        id: member.id,
        appUserId: member.app_user_id,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        phone: member.phone,
        username: member.username,
        dateOfBirth: member.date_of_birth,
        age: member.age ? parseInt(member.age) : null,
        status: member.status,
        isActive: member.is_active,
        hasCompletedWaivers: member.has_completed_waivers || false,
        isFamilyPayer: billingAccount?.payer_member_id != null && Number(billingAccount.payer_member_id) === Number(member.id),
        parentGuardianIds: member.parent_guardian_ids || [],
        emergencyContacts: member.emergency_contacts || []
      }
      
      return memberData
    })
    
    // Get parent/guardian details for children
    for (const member of members) {
      if (member.parentGuardianIds && member.parentGuardianIds.length > 0) {
        const parentsResult = await pool.query(`
          SELECT id, first_name, last_name, email, phone, username
          FROM member
          WHERE id = ANY($1::bigint[])
        `, [member.parentGuardianIds])
        member.parentGuardians = parentsResult.rows.map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          phone: p.phone,
          username: p.username
        }))
      }
    }
    
    res.json({
      success: true,
      data: {
        id: family.id,
        facilityId: family.facility_id,
        familyName: family.family_name,
        familyUsername: family.family_username,
        archived: family.archived || false,
        payerMemberId: billingAccount?.payer_member_id ?? null,
        billingAccount: billingAccount ? {
          id: billingAccount.id,
          payerMemberId: billingAccount.payer_member_id,
          billingEmail: billingAccount.billing_email,
          billingPhone: billingAccount.billing_phone,
          billingStreet: billingAccount.billing_street,
          billingCity: billingAccount.billing_city,
          billingState: billingAccount.billing_state,
          billingZip: billingAccount.billing_zip,
        } : null,
        members: members,
        memberCount: members.length,
        createdAt: family.created_at,
        updatedAt: family.updated_at
      }
    })
  } catch (error) {
    console.error('Get family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create family (admin endpoint) - simplified, no primary member concept
app.post('/api/admin/families', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    const { error, value } = familySchema.validate(req.body)
    if (error) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Get facility
    let facilityId = value.facilityId
    if (!facilityId) {
      const facilityTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'facility'
        )
      `)
      
      if (facilityTableCheck.rows[0].exists) {
        let facilityResult = await client.query('SELECT id FROM facility LIMIT 1')
        if (facilityResult.rows.length > 0) {
          facilityId = facilityResult.rows[0].id
        } else {
          // Create default facility
          const defaultFacilityResult = await client.query(`
            INSERT INTO facility (name, timezone)
            VALUES ('Vortex Athletics', 'America/New_York')
            RETURNING id
          `)
          facilityId = defaultFacilityResult.rows[0].id
        }
      }
    }
    
    // Generate unique family username
    const uniqueUsername = await generateFamilyUsername(value.familyUsername, facilityId)
    
    // Hash family password
    const familyPasswordHash = await hashFamilyPassword(value.familyPassword)
    
    // Create family - no primary member, all members are equal
    const familyResult = await client.query(`
      INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, family_name, family_username, created_at
    `, [facilityId, value.familyName, uniqueUsername, familyPasswordHash])
    
    const family = familyResult.rows[0]
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: 'Family created successfully',
      data: {
        id: family.id,
        familyName: family.family_name,
        familyUsername: family.family_username,
        createdAt: family.created_at
      }
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Create family error:', error)
    
    // Check if it's a unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Family username already exists. Please choose a different username.'
      })
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
  }
})

// Update family (admin endpoint) - simplified, no primary member concept
app.put('/api/admin/families/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    const { id } = req.params
    const { familyName, familyUsername, familyPassword } = req.body
    
    // Check if family exists
    const familyCheck = await client.query('SELECT id FROM family WHERE id = $1', [id])
    if (familyCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
    const updates = []
    const params = []
    let paramCount = 0
    
    if (familyName !== undefined) {
      paramCount++
      updates.push(`family_name = $${paramCount}`)
      params.push(familyName)
    }
    
    if (familyUsername !== undefined) {
      paramCount++
      // Check if username is already taken by another family
      const usernameCheck = await client.query(`
        SELECT id FROM family WHERE family_username = $1 AND id != $2
      `, [familyUsername, id])
      
      if (usernameCheck.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: 'Family username already exists. Please choose a different username.'
        })
      }
      
      updates.push(`family_username = $${paramCount}`)
      params.push(familyUsername)
    }
    
    if (familyPassword !== undefined && familyPassword) {
      paramCount++
      const passwordHash = await hashFamilyPassword(familyPassword)
      updates.push(`family_password_hash = $${paramCount}`)
      params.push(passwordHash)
    }
    
    if (updates.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }
    
    updates.push(`updated_at = now()`)
    paramCount++
    params.push(id)
    
    await client.query(`
      UPDATE family 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `, params)
    
    await client.query('COMMIT')
    
    // Fetch updated family
    const updatedFamilyResult = await client.query(`
      SELECT id, family_name, family_username, created_at, updated_at
      FROM family WHERE id = $1
    `, [id])
    
    res.json({
      success: true,
      message: 'Family updated successfully',
      data: updatedFamilyResult.rows[0]
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Update family error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
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
    
    // Start a transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Update family archived status
      await client.query('UPDATE family SET archived = $1, updated_at = now() WHERE id = $2', [archived, id])
      
      // Update member status for all members in this family
      // When family is archived, archive all members
      // When family is unarchived, restore members (but keep their individual status)
      if (archived) {
        // Set all family members to archived
        await client.query(`
          UPDATE member 
          SET is_active = FALSE, status = 'archived', updated_at = NOW()
          WHERE family_id = $1
        `, [id])
      } else {
        // Unarchive family members (restore is_active but keep status based on enrollments + waivers)
        await client.query(`
          UPDATE member 
          SET is_active = TRUE, updated_at = NOW()
          WHERE family_id = $1
        `, [id])
        
        // Update athlete status for all family members (will recalculate based on enrollments + waivers)
        const familyMembersResult = await client.query('SELECT id FROM member WHERE family_id = $1', [id])
        for (const memberRow of familyMembersResult.rows) {
          await updateMemberAthleteStatus(memberRow.id)
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
    
    // Get all app users linked to active members in this family.
    const familyUsersResult = await pool.query(`
      SELECT DISTINCT m.app_user_id as user_id
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE fm.family_id = $1
        AND m.app_user_id IS NOT NULL
    `, [id])
    
    const userIds = familyUsersResult.rows.map(row => row.user_id).filter(id => id !== null)
    
    // Get all member IDs associated with this family
    const membersResult = await pool.query(`
      SELECT DISTINCT m.id
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE fm.family_id = $1
        AND m.facility_id = $2
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
      
      // Delete the family (this cascades canonical family_member/billing records).
      await client.query('DELETE FROM family WHERE id = $1', [id])
      
      // Delete associated app users only when they are family-only accounts.
      const deletedUserEmails = []
      for (const userId of userIds) {
        const otherFamiliesResult = await client.query(`
          SELECT COUNT(*) as count
          FROM family_member fm
          JOIN member m ON m.id = fm.member_id
          WHERE m.app_user_id = $1
            AND fm.is_active = TRUE
            AND fm.family_id <> $2
        `, [userId, id])
        
        const otherFamiliesCount = parseInt(otherFamiliesResult.rows[0].count)
        const rolesResult = await client.query(`
          SELECT role_key
          FROM (
            SELECT role::text as role_key FROM app_user WHERE id = $1
            UNION
            SELECT role::text as role_key FROM app_user_role WHERE user_id = $1
          ) roles
        `, [userId])
        const roles = rolesResult.rows.map((row) => row.role_key)
        const familyOnlyRoles = roles.every((role) =>
          ['MEMBER_ATHLETE'].includes(role),
        )
        
        if (otherFamiliesCount === 0 && familyOnlyRoles) {
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

    // The default master admin account is permanent and cannot be deleted.
    if (decodedEmail.trim().toLowerCase() === DEFAULT_MASTER_EMAIL) {
      return res.status(400).json({
        success: false,
        message: 'The default master admin account cannot be deleted.'
      })
    }
    
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
    
    // Get all family IDs associated with this user's linked member records.
    const familiesResult = await pool.query(`
      SELECT DISTINCT fm.family_id as id
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE m.app_user_id = $1
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
            `SELECT DISTINCT m.id
             FROM family_member fm
             JOIN member m ON m.id = fm.member_id
             WHERE fm.family_id = $1 AND m.facility_id = $2`,
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
      await client.query('DELETE FROM member WHERE app_user_id = $1', [userId])
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

// Search members by name, email, phone, or username (for parent/guardian selection)
app.get('/api/admin/members/search', async (req, res) => {
  try {
    const { q, adultsOnly } = req.query
    
    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    const searchQuery = `%${q.trim()}%`
    
    let query = `
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.phone,
        m.username,
        m.date_of_birth,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        m.family_id,
        f.family_name
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      WHERE m.is_active = TRUE
        AND (
          m.first_name ILIKE $1 OR 
          m.last_name ILIKE $1 OR 
          m.email ILIKE $1 OR
          m.phone ILIKE $1 OR
          m.username ILIKE $1 OR
          (m.first_name || ' ' || m.last_name) ILIKE $1
        )
    `
    
    const params = [searchQuery]
    
    // Filter to adults only if requested (for parent/guardian selection)
    if (adultsOnly === 'true') {
      query += ` AND (m.date_of_birth IS NULL OR EXTRACT(YEAR FROM AGE(m.date_of_birth)) >= 18)`
    }
    
    // Check facility_id column exists
    const facilityColumnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
        AND column_name = 'facility_id'
      )
    `)
    
    if (facilityColumnCheck.rows[0].exists) {
      const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
      if (facilityResult.rows.length > 0) {
        query += ` AND m.facility_id = $2`
        params.push(facilityResult.rows[0].id)
      }
    }
    
    query += ` ORDER BY m.last_name, m.first_name LIMIT 50`
    
    const result = await pool.query(query, params)
    
    const members = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      username: row.username,
      dateOfBirth: row.date_of_birth,
      age: row.age ? parseInt(row.age) : null,
      familyId: row.family_id,
      familyName: row.family_name,
      isAdult: !row.date_of_birth || (row.age ? row.age >= 18 : true)
    }))
    
    res.json({
      success: true,
      data: members
    })
  } catch (error) {
    console.error('Search members error:', error)
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


// Get single member (admin endpoint) - simplified, all members are equal
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
        f.family_name,
        f.family_username,
        f.id as family_id
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
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
    
    // Get parent/guardians if child
    let parentGuardians = []
    if (member.parent_guardian_ids && member.parent_guardian_ids.length > 0) {
      const parentsResult = await pool.query(`
        SELECT id, first_name, last_name, email, phone, username
        FROM member
        WHERE id = ANY($1::bigint[])
      `, [member.parent_guardian_ids])
      parentGuardians = parentsResult.rows.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        phone: p.phone,
        username: p.username
      }))
    }
    
    // Get children if adult
    const children = await getMemberChildren(parseInt(id))
    
    // Get emergency contacts
    let emergencyContacts = []
    try {
      const contactsResult = await pool.query(`
        SELECT * FROM emergency_contact WHERE member_id = $1 ORDER BY created_at
      `, [id])
      emergencyContacts = contactsResult.rows
    } catch (contactsError) {
      console.warn('Error getting emergency contacts:', contactsError.message)
    }

    // Roles from app_user / app_user_role (same query pattern as member list)
    let roles = []
    try {
      const rolesResult = await pool.query(`
        SELECT json_agg(DISTINCT jsonb_build_object('id', role_key, 'role', role_key)) as roles
        FROM member m
        JOIN app_user au ON au.id = m.app_user_id
        CROSS JOIN LATERAL (
          SELECT au.role::text as role_key
          UNION
          SELECT aur.role::text as role_key
          FROM app_user_role aur
          WHERE aur.user_id = au.id
        ) role_rows
        WHERE m.id = $1
      `, [id])
      roles = rolesResult.rows[0]?.roles || []
    } catch (rolesError) {
      console.warn('Error getting member roles:', rolesError.message)
    }
    
    // Get enrollments
    let enrollments = []
    try {
      const enrollmentsResult = await pool.query(`
        SELECT 
          mp.id,
          mp.program_id,
          mp.iteration_id,
          mp.days_per_week,
          mp.selected_days,
          mp.created_at,
          mp.updated_at,
          p.display_name as program_display_name
        FROM member_program mp
        LEFT JOIN program p ON mp.program_id = p.id
        WHERE mp.member_id = $1
        ORDER BY mp.created_at DESC
      `, [id])
      enrollments = enrollmentsResult.rows.map(e => ({
        id: e.id,
        programId: e.program_id,
        iterationId: e.iteration_id,
        daysPerWeek: e.days_per_week,
        selectedDays: e.selected_days,
        programDisplayName: e.program_display_name,
        createdAt: e.created_at,
        updatedAt: e.updated_at
      }))
    } catch (enrollmentsError) {
      console.warn('Error getting enrollments:', enrollmentsError.message)
    }
    
    // Format response
    res.json({
      success: true,
      data: {
        id: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        phone: member.phone,
        username: member.username,
        dateOfBirth: member.date_of_birth,
        age: member.age ? parseInt(member.age) : null,
        familyId: member.family_id,
        familyName: member.family_name,
        familyUsername: member.family_username,
        parentGuardianIds: member.parent_guardian_ids || [],
        parentGuardians: parentGuardians,
        children: children.map(c => ({
          id: c.id,
          firstName: c.first_name,
          lastName: c.last_name,
          email: c.email,
          phone: c.phone,
          dateOfBirth: c.date_of_birth
        })),
        hasCompletedWaivers: member.has_completed_waivers || false,
        waiverCompletionDate: member.waiver_completion_date,
        status: member.status,
        isActive: member.is_active,
        medicalNotes: member.medical_notes,
        internalFlags: member.internal_flags,
        address: member.address,
        billingStreet: member.billing_street,
        billingCity: member.billing_city,
        billingState: member.billing_state,
        billingZip: member.billing_zip,
        emergencyContacts: emergencyContacts,
        enrollments: enrollments,
        roles: roles,
        createdAt: member.created_at,
        updatedAt: member.updated_at
      }
    })
  } catch (error) {
    console.error('Get member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create member (admin endpoint) - simplified unified member creation
// Supports: Create new family OR Join existing family OR No family (orphan)
app.post('/api/admin/members', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // Validate request body using memberSchema
    const { error, value } = memberSchema.validate(req.body)
    if (error) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Get facility ID
    let facilityId = null
    const facilityTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'facility'
      )
    `)
    
    if (facilityTableCheck.rows[0].exists) {
      let facilityResult = await client.query('SELECT id FROM facility LIMIT 1')
      if (facilityResult.rows.length > 0) {
        facilityId = facilityResult.rows[0].id
      } else {
        // Create default facility
        const defaultFacilityResult = await client.query(`
          INSERT INTO facility (name, timezone)
          VALUES ('Vortex Athletics', 'America/New_York')
          RETURNING id
        `)
        facilityId = defaultFacilityResult.rows[0].id
      }
    }
    
    // Handle family assignment
    let familyId = value.familyId || null
    let familyHadMembersBefore = false
    
    // Option 1: Create new family
    if (!familyId && value.familyName && value.familyUsername && value.familyPassword) {
      // Generate unique family username if needed
      const uniqueUsername = await generateFamilyUsername(value.familyUsername, facilityId)
      const familyPasswordHash = await hashFamilyPassword(value.familyPassword)
      
      const newFamilyResult = await client.query(`
        INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, family_username
      `, [facilityId, value.familyName, uniqueUsername, familyPasswordHash])
      
      familyId = newFamilyResult.rows[0].id
      console.log('[POST /api/admin/members] Created new family:', familyId, newFamilyResult.rows[0].family_username)
    }
    // Option 2: Join existing family by ID (already verified)
    else if (familyId) {
      familyHadMembersBefore = (await countActiveFamilyMembers(client, familyId)) > 0
      const familyCheck = await client.query('SELECT id, family_username FROM family WHERE id = $1 AND archived = FALSE', [familyId])
      if (familyCheck.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({
        success: false,
          message: 'Family not found'
        })
      }
    }
    // Option 3: Join existing family by username + password
    else if (value.familyUsername && value.familyPassword) {
      const familyCheck = await client.query(`
        SELECT id, family_password_hash FROM family 
        WHERE family_username = $1 AND archived = FALSE
      `, [value.familyUsername])
      
    if (familyCheck.rows.length === 0) {
        await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }
    
      const family = familyCheck.rows[0]
      const passwordValid = await verifyFamilyPassword(value.familyPassword, family.family_password_hash)
      
      if (!passwordValid) {
        await client.query('ROLLBACK')
        return res.status(401).json({
          success: false,
          message: 'Invalid family password'
        })
      }
      
      familyId = family.id
      familyHadMembersBefore = (await countActiveFamilyMembers(client, familyId)) > 0
      console.log('[POST /api/admin/members] Member joining family by username:', familyId)
    }
    // Option 4: No family (orphan member) - allowed
    else {
      familyId = null
    }
    
    // Check if member already belongs to another family (members can only belong to 1 family)
    if (familyId) {
      // This check will be done after member creation if they already exist
      // For now, we'll allow it since this is a new member creation
    }
    
    // Validate parent/guardian IDs if child (< 18)
    const isChild = value.dateOfBirth && !isAdult(value.dateOfBirth)
    
    // Support both new parentGuardians structure (with relationships) and legacy parentGuardianIds
    let parentGuardianIds = []
    let parentGuardians = value.parentGuardians || []
    
    if (parentGuardians.length > 0) {
      // New structure: extract IDs from parentGuardians array
      parentGuardianIds = parentGuardians.map(pg => pg.id).filter(id => id > 0) // Filter out negative IDs (family members)
    } else {
      // Legacy structure: use parentGuardianIds directly
      parentGuardianIds = value.parentGuardianIds || []
      // Convert to parentGuardians format for consistency
      parentGuardians = parentGuardianIds.map(id => ({ id, relationship: null, relationshipOther: null }))
    }
    
    if (isChild) {
      if (!parentGuardianIds || parentGuardianIds.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: 'Children under 18 must have at least one parent/guardian specified'
        })
      }
      
      // Validate parent guardians are adults and exist
      const validation = await validateParentGuardians(parentGuardianIds)
      if (!validation.valid) {
        await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
          message: validation.error
        })
      }
    }
    
    // Hash member password if provided
    let memberPasswordHash = null
    if (value.password) {
      memberPasswordHash = await bcrypt.hash(value.password, 10)
    }
    
    // Create member
    const insertQuery = `
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, email, phone,
        date_of_birth, username, password_hash,
        address, billing_street, billing_city, billing_state, billing_zip,
        parent_guardian_ids, has_completed_waivers, waiver_completion_date,
        medical_notes, medical_concerns, internal_flags,
        gender, injury_history_date, injury_history_body_part, injury_history_notes, no_injury_history,
        experience, status, is_active, profile_complete, signup_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, 'legacy', TRUE, TRUE, 'admin')
      RETURNING *
    `
    
    const insertParams = [
      facilityId,
      familyId,
      value.firstName,
      value.lastName,
      value.email || null,
      value.phone || null,
      value.dateOfBirth && value.dateOfBirth !== '' ? value.dateOfBirth : null,
      value.username || null,
      memberPasswordHash,
      value.address || null,
      value.billingStreet || null,
      value.billingCity || null,
      value.billingState || null,
      value.billingZip || null,
      parentGuardianIds.length > 0 ? parentGuardianIds : null, // Array or NULL
      value.hasCompletedWaivers || false,
      value.hasCompletedWaivers && value.waiverCompletionDate ? value.waiverCompletionDate : null,
      value.medicalNotes || null,
      value.medicalConcerns || null,
      value.internalFlags || null,
      value.gender || null,
      value.injuryHistoryDate && value.injuryHistoryDate !== '' ? value.injuryHistoryDate : null,
      value.injuryHistoryBodyPart || null,
      value.injuryHistoryNotes || null,
      value.noInjuryHistory || false,
      value.experience || null
    ]
    
    const memberResult = await client.query(insertQuery, insertParams)
    const member = memberResult.rows[0]
    
    // Calculate age
    if (member.date_of_birth) {
      const ageResult = await client.query(`
        SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) as age 
        FROM member WHERE id = $1
      `, [member.id])
      member.age = ageResult.rows.length > 0 ? parseInt(ageResult.rows[0].age) : null
    } else {
      member.age = null
    }
    
    // Create or update corresponding app_user record if member has login credentials
    // This is required for member portal login (/api/members/login)
    if ((member.email || member.username) && memberPasswordHash) {
      try {
        const fullName = `${value.firstName} ${value.lastName}`.trim()
        const memberRole = 'MEMBER_ATHLETE'
        
        // Check if app_user already exists with this ID
        const existingAppUser = await client.query('SELECT id FROM app_user WHERE id = $1', [member.id])
        
        if (existingAppUser.rows.length > 0) {
          // Update existing app_user
          await client.query(`
            UPDATE app_user
            SET 
              full_name = $1,
              email = $2,
              phone = $3,
              username = $4,
              password_hash = $5,
              role = $6,
              is_active = $7,
              facility_id = $8,
              address = $9,
              updated_at = NOW()
            WHERE id = $10
          `, [
            fullName,
            member.email || null,
            member.phone || null,
            member.username || null,
            memberPasswordHash,
            memberRole,
            member.is_active,
            facilityId,
            value.address || null,
            member.id
          ])
          console.log(`[POST /api/admin/members] Updated app_user record for member ${member.id}`)
        } else {
          // Create new app_user with same ID as member
          await client.query(`
            INSERT INTO app_user (
              id, full_name, email, phone, username, password_hash,
              role, is_active, facility_id, address, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          `, [
            member.id,
            fullName,
            member.email || null,
            member.phone || null,
            member.username || null,
            memberPasswordHash,
            memberRole,
            member.is_active,
            facilityId,
            value.address || null
          ])
          console.log(`[POST /api/admin/members] Created app_user record for member ${member.id}`)
        }
      } catch (appUserError) {
        // Log error but don't fail member creation
        console.error('[POST /api/admin/members] Error creating/updating app_user:', appUserError.message)
        console.error('Member was created but app_user sync failed. Member login may not work.')
      }
    }
    
    // Update parent/guardian authority table (save relationship metadata)
    if (parentGuardians.length > 0) {
      for (const pg of parentGuardians) {
        // Only process if ID is positive (negative IDs are temporary family member IDs)
        if (pg.id > 0) {
          try {
            await client.query(`
              INSERT INTO parent_guardian_authority (parent_member_id, child_member_id, has_legal_authority, relationship, notes)
              VALUES ($1, $2, TRUE, $3, $4)
              ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
              SET has_legal_authority = TRUE, relationship = $3, notes = $4, updated_at = NOW()
            `, [
              pg.id, 
              member.id, 
              pg.relationship || null,
              pg.relationshipOther || null
            ])
          } catch (pgError) {
            // Table might not exist, that's okay - we're using parent_guardian_ids array
            console.warn('Error updating parent_guardian_authority:', pgError.message)
          }
        }
      }
    } else if (parentGuardianIds.length > 0) {
      // Legacy: only IDs provided, save without relationship info
      for (const parentId of parentGuardianIds) {
        try {
          await client.query(`
            INSERT INTO parent_guardian_authority (parent_member_id, child_member_id, has_legal_authority)
            VALUES ($1, $2, TRUE)
            ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
            SET has_legal_authority = TRUE, updated_at = NOW()
          `, [parentId, member.id])
        } catch (pgError) {
          // Table might not exist, that's okay - we're using parent_guardian_ids array
          console.warn('Error updating parent_guardian_authority:', pgError.message)
        }
      }
    }
    
    // Update athlete status (based on enrollments + waivers)
    await updateMemberAthleteStatus(member.id)
    
    await client.query('COMMIT')

    void notifyWelcomeNewMember(pool, member.id, { context: 'admin_create' })
    if (familyHadMembersBefore && familyId) {
      void notifyFamilyGuardiansNewMember(pool, {
        familyId,
        newMemberId: member.id,
      })
    }

    // Format response
    res.json({
      success: true,
      message: 'Member created successfully',
      data: {
        id: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email,
        phone: member.phone,
        dateOfBirth: member.date_of_birth,
        age: member.age,
        familyId: member.family_id,
        parentGuardianIds: member.parent_guardian_ids || [],
        hasCompletedWaivers: member.has_completed_waivers,
        status: member.status,
        isActive: member.is_active,
        createdAt: member.created_at,
        updatedAt: member.updated_at
      }
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Create member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
  }
})

// Helper function to update member status based on enrollments and family activity
// NOTE: This is kept for backward compatibility but should use updateMemberAthleteStatus instead
// This function uses old status logic (enrolled, family_active, legacy)
// The new updateMemberAthleteStatus uses: legacy, enrolled, athlete (enrolled + waivers), archived
const updateMemberStatus = async (memberId) => {
  // Redirect to new athlete status logic
  return await updateMemberAthleteStatus(memberId)
}

// Update member (admin endpoint) - renamed from athletes to members
// Update member (admin endpoint)
app.put('/api/admin/members/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    const { id } = req.params
    console.log(`[PUT /api/admin/members/:id] Updating member ${id}`)
    console.log(`[PUT /api/admin/members/:id] Request body:`, JSON.stringify(req.body, null, 2))
    const { error, value } = memberUpdateSchema.validate(req.body, { abortEarly: false })
    if (error) {
      await client.query('ROLLBACK')
      console.error('[PUT /api/admin/members/:id] Validation error:', error.details)
      console.error('[PUT /api/admin/members/:id] Request body:', JSON.stringify(req.body, null, 2))
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }
    
    // Check if member exists
    const memberCheck = await client.query('SELECT id, date_of_birth FROM member WHERE id = $1', [id])
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const existingMember = memberCheck.rows[0]
    const isChild = existingMember.date_of_birth && !isAdult(existingMember.date_of_birth)
    
    // Validate parent/guardian IDs if updating for a child
    if (value.parentGuardianIds !== undefined && isChild) {
      if (!value.parentGuardianIds || value.parentGuardianIds.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: 'Children under 18 must have at least one parent/guardian'
        })
      }
      
      const validation = await validateParentGuardians(value.parentGuardianIds)
      if (!validation.valid) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: validation.error
        })
      }
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
    if (value.email !== undefined) {
      paramCount++
      updates.push(`email = $${paramCount}`)
      params.push(value.email || null)
    }
    if (value.phone !== undefined) {
      paramCount++
      updates.push(`phone = $${paramCount}`)
      params.push(value.phone || null)
    }
    if (value.dateOfBirth !== undefined) {
      paramCount++
      updates.push(`date_of_birth = $${paramCount}`)
      params.push(value.dateOfBirth && value.dateOfBirth !== '' ? value.dateOfBirth : null)
    }
    if (value.username !== undefined) {
      paramCount++
      updates.push(`username = $${paramCount}`)
      params.push(value.username || null)
    }
    if (value.password !== undefined && value.password) {
      paramCount++
      const passwordHash = await bcrypt.hash(value.password, 10)
      updates.push(`password_hash = $${paramCount}`)
      params.push(passwordHash)
    }
    if (value.parentGuardianIds !== undefined) {
      paramCount++
      updates.push(`parent_guardian_ids = $${paramCount}`)
      params.push(value.parentGuardianIds && value.parentGuardianIds.length > 0 ? value.parentGuardianIds : null)
    }
    if (value.hasCompletedWaivers !== undefined) {
      paramCount++
      updates.push(`has_completed_waivers = $${paramCount}`)
      params.push(value.hasCompletedWaivers)
    }
    if (value.waiverCompletionDate !== undefined) {
      paramCount++
      updates.push(`waiver_completion_date = $${paramCount}`)
      params.push(value.waiverCompletionDate || null)
    }
    if (value.medicalNotes !== undefined) {
      paramCount++
      updates.push(`medical_notes = $${paramCount}`)
      params.push(value.medicalNotes || null)
    }
    if (value.medicalConcerns !== undefined) {
      paramCount++
      updates.push(`medical_concerns = $${paramCount}`)
      params.push(value.medicalConcerns || null)
    }
    if (value.gender !== undefined) {
      paramCount++
      updates.push(`gender = $${paramCount}`)
      params.push(value.gender || null)
    }
    if (value.internalFlags !== undefined) {
      paramCount++
      updates.push(`internal_flags = $${paramCount}`)
      params.push(value.internalFlags || null)
    }
    if (value.address !== undefined) {
      paramCount++
      updates.push(`address = $${paramCount}`)
      params.push(value.address || null)
    }
    if (value.billingStreet !== undefined) {
      paramCount++
      updates.push(`billing_street = $${paramCount}`)
      params.push(value.billingStreet || null)
    }
    if (value.billingCity !== undefined) {
      paramCount++
      updates.push(`billing_city = $${paramCount}`)
      params.push(value.billingCity || null)
    }
    if (value.billingState !== undefined) {
      paramCount++
      updates.push(`billing_state = $${paramCount}`)
      params.push(value.billingState || null)
    }
    if (value.billingZip !== undefined) {
      paramCount++
      updates.push(`billing_zip = $${paramCount}`)
      params.push(value.billingZip || null)
    }
    if (value.injuryHistoryDate !== undefined) {
      paramCount++
      updates.push(`injury_history_date = $${paramCount}`)
      params.push(value.injuryHistoryDate && value.injuryHistoryDate !== '' ? value.injuryHistoryDate : null)
    }
    if (value.injuryHistoryBodyPart !== undefined) {
      paramCount++
      updates.push(`injury_history_body_part = $${paramCount}`)
      params.push(value.injuryHistoryBodyPart || null)
    }
    if (value.injuryHistoryNotes !== undefined) {
      paramCount++
      updates.push(`injury_history_notes = $${paramCount}`)
      params.push(value.injuryHistoryNotes || null)
    }
    if (value.noInjuryHistory !== undefined) {
      paramCount++
      updates.push(`no_injury_history = $${paramCount}`)
      params.push(value.noInjuryHistory || false)
    }
    if (value.experience !== undefined) {
      paramCount++
      updates.push(`experience = $${paramCount}`)
      params.push(value.experience || null)
    }
    
    if (updates.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }
    
    updates.push(`updated_at = now()`)
    paramCount++
    params.push(id)
    
    console.log(`[PUT /api/admin/members/:id] Update query:`, `UPDATE member SET ${updates.join(', ')} WHERE id = $${paramCount}`)
    console.log(`[PUT /api/admin/members/:id] Update params:`, params)
    
    await client.query(`
      UPDATE member 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `, params)
    
    console.log(`[PUT /api/admin/members/:id] Update successful`)
    
    // Update parent/guardian authority table BEFORE app_user sync (to avoid transaction abort issues)
    if (value.parentGuardianIds !== undefined || value.parentGuardians !== undefined) {
      // Delete existing relationships
      try {
        await client.query(`
          DELETE FROM parent_guardian_authority WHERE child_member_id = $1
        `, [id])
        
        // Use parentGuardians if provided (with relationships), otherwise use parentGuardianIds
        if (value.parentGuardians && value.parentGuardians.length > 0) {
          // New structure: save with relationships
          for (const pg of value.parentGuardians) {
            if (pg.id > 0) { // Only process positive IDs
              await client.query(`
                INSERT INTO parent_guardian_authority (parent_member_id, child_member_id, has_legal_authority, relationship, notes)
                VALUES ($1, $2, TRUE, $3, $4)
                ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
                SET has_legal_authority = TRUE, relationship = $3, notes = $4, updated_at = NOW()
              `, [pg.id, id, pg.relationship || null, pg.relationshipOther || null])
            }
          }
        } else if (value.parentGuardianIds && value.parentGuardianIds.length > 0) {
          // Legacy structure: only IDs provided
          for (const parentId of value.parentGuardianIds) {
            await client.query(`
              INSERT INTO parent_guardian_authority (parent_member_id, child_member_id, has_legal_authority)
              VALUES ($1, $2, TRUE)
              ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
              SET has_legal_authority = TRUE, updated_at = NOW()
            `, [parentId, id])
          }
        }
      } catch (pgError) {
        // Table might not exist, that's okay - use savepoint to prevent transaction abort
        try {
          await client.query('SAVEPOINT before_pg_authority')
          console.warn('Error updating parent_guardian_authority:', pgError.message)
          await client.query('ROLLBACK TO SAVEPOINT before_pg_authority')
        } catch (spError) {
          console.warn('Error handling parent_guardian_authority error:', spError.message)
        }
      }
    }
    
    // Sync app_user record if login credentials are present
    // Get updated member data to check for email/username/password
    const updatedMemberCheck = await client.query('SELECT email, username, password_hash, first_name, last_name, phone, is_active, facility_id, address FROM member WHERE id = $1', [id])
    if (updatedMemberCheck.rows.length > 0) {
      const updatedMemberData = updatedMemberCheck.rows[0]
      const hasLoginCredentials = (updatedMemberData.email || updatedMemberData.username) && updatedMemberData.password_hash
      
      if (hasLoginCredentials) {
        // Use savepoint to prevent app_user sync errors from aborting the transaction
        await client.query('SAVEPOINT before_app_user_sync')
        try {
          const fullName = `${value.firstName !== undefined ? value.firstName : updatedMemberData.first_name} ${value.lastName !== undefined ? value.lastName : updatedMemberData.last_name}`.trim()
          const memberEmail = value.email !== undefined ? (value.email || null) : updatedMemberData.email
          const memberUsername = value.username !== undefined ? (value.username || null) : updatedMemberData.username
          const memberPhone = value.phone !== undefined ? (value.phone || null) : updatedMemberData.phone
          const memberPasswordHash = value.password !== undefined && value.password ? await bcrypt.hash(value.password, 10) : updatedMemberData.password_hash
          const memberIsActive = value.isActive !== undefined ? value.isActive : updatedMemberData.is_active
          
          // All member accounts use the unified MEMBER_ATHLETE role.
          // Youth vs adult is derived from date_of_birth, not the role.
          const memberRole = 'MEMBER_ATHLETE'
          
          // Get facility_id
          let memberFacilityId = null
          const facilityCheck = await client.query('SELECT id FROM facility LIMIT 1')
          if (facilityCheck.rows.length > 0) {
            memberFacilityId = facilityCheck.rows[0].id
          }
          
          // Check if app_user exists (by checking if member.id exists in app_user table)
          const existingAppUser = await client.query('SELECT id FROM app_user WHERE id = $1', [id])
          
          if (existingAppUser.rows.length > 0) {
            // EDIT MODE: app_user exists, so this is an edit
            // Allow duplicate email - just update whatever email is provided
            await client.query(`
              UPDATE app_user
              SET 
                full_name = $1,
                email = $2,
                phone = $3,
                username = $4,
                password_hash = $5,
                role = $6,
                is_active = $7,
                facility_id = $8,
                address = $9,
                updated_at = NOW()
              WHERE id = $10
            `, [
              fullName,
              memberEmail,
              memberPhone,
              memberUsername,
              memberPasswordHash,
              memberRole,
              memberIsActive,
              memberFacilityId,
              value.address !== undefined ? (value.address || null) : updatedMemberData.address,
              id
            ])
            console.log(`[PUT /api/admin/members] Updated app_user record for member ${id} (edit mode - email update allowed)`)
          } else {
            // NEW USER MODE: app_user doesn't exist, so this is a new user
            // Check for duplicate email before creating
            if (memberEmail) {
              const emailCheck = await client.query('SELECT id FROM app_user WHERE email = $1 AND facility_id = $2', [memberEmail, memberFacilityId])
              if (emailCheck.rows.length > 0) {
                // Email already exists for another user - skip app_user creation
                console.warn(`[PUT /api/admin/members] Email ${memberEmail} already exists for another app_user, skipping app_user creation for new member ${id}`)
              } else {
                // Email is available, create new app_user
                await client.query(`
                  INSERT INTO app_user (
                    id, full_name, email, phone, username, password_hash,
                    role, is_active, facility_id, address, created_at, updated_at
                  )
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                `, [
                  id,
                  fullName,
                  memberEmail,
                  memberPhone,
                  memberUsername,
                  memberPasswordHash,
                  memberRole,
                  memberIsActive,
                  memberFacilityId,
                  value.address !== undefined ? (value.address || null) : updatedMemberData.address
                ])
                console.log(`[PUT /api/admin/members] Created app_user record for member ${id} (new user mode)`)
              }
            } else {
              // No email provided, create app_user without email
              await client.query(`
                INSERT INTO app_user (
                  id, full_name, phone, username, password_hash,
                  role, is_active, facility_id, address, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
              `, [
                id,
                fullName,
                memberPhone,
                memberUsername,
                memberPasswordHash,
                memberRole,
                memberIsActive,
                memberFacilityId,
                value.address !== undefined ? (value.address || null) : updatedMemberData.address
              ])
              console.log(`[PUT /api/admin/members] Created app_user record for member ${id} (new user mode, no email)`)
            }
          }
          // Release savepoint on success
          await client.query('RELEASE SAVEPOINT before_app_user_sync')
        } catch (appUserError) {
          // Log error but don't fail member update
          // Rollback to savepoint to continue transaction
          try {
            await client.query('ROLLBACK TO SAVEPOINT before_app_user_sync')
            console.error('[PUT /api/admin/members] Error syncing app_user (rolled back to savepoint):', appUserError.message)
          } catch (spError) {
            // If rollback fails, the transaction is already aborted - we need to rollback the whole transaction
            console.error('[PUT /api/admin/members] Error rolling back to savepoint, transaction may be aborted:', spError.message)
            throw spError
          }
        }
      }
    }
    
    // Update member athlete status (based on enrollments + waivers)
    await updateMemberAthleteStatus(parseInt(id))
    
    await client.query('COMMIT')

    // School links (many-to-many) + optional "Other" write-in. Done post-commit so
    // a link failure never rolls back the member update.
    if (value.schoolIds !== undefined || value.schoolWriteIn) {
      try {
        await setMemberSchools(pool, parseInt(id), value.schoolIds || [], value.schoolWriteIn || null)
      } catch (schoolErr) {
        console.error('[PUT /api/admin/members] Error updating school links:', schoolErr.message)
      }
    }
    
    // Re-fetch member with updated status
    const updatedMemberResult = await pool.query(`
      SELECT 
        m.*,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age,
        f.family_name,
        f.family_username
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      WHERE m.id = $1
    `, [id])
    
    if (updatedMemberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const updatedMember = updatedMemberResult.rows[0]
    
    // Get parent guardians info if child
    let parentGuardians = []
    if (updatedMember.parent_guardian_ids && updatedMember.parent_guardian_ids.length > 0) {
      const parentsResult = await pool.query(`
        SELECT id, first_name, last_name, email, phone
        FROM member
        WHERE id = ANY($1::bigint[])
      `, [updatedMember.parent_guardian_ids])
      parentGuardians = parentsResult.rows
    }
    
    // Get children if adult
    const children = await getMemberChildren(parseInt(id))
    
    res.json({
      success: true,
      message: 'Member updated successfully',
      data: {
        id: updatedMember.id,
        firstName: updatedMember.first_name,
        lastName: updatedMember.last_name,
        email: updatedMember.email,
        phone: updatedMember.phone,
        dateOfBirth: updatedMember.date_of_birth,
        age: updatedMember.age ? parseInt(updatedMember.age) : null,
        username: updatedMember.username,
        familyId: updatedMember.family_id,
        familyName: updatedMember.family_name,
        familyUsername: updatedMember.family_username,
        parentGuardianIds: updatedMember.parent_guardian_ids || [],
        parentGuardians: parentGuardians,
        children: children,
        hasCompletedWaivers: updatedMember.has_completed_waivers,
        waiverCompletionDate: updatedMember.waiver_completion_date,
        status: updatedMember.status,
        isActive: updatedMember.is_active,
        gender: updatedMember.gender,
        medicalConcerns: updatedMember.medical_concerns,
        medicalNotes: updatedMember.medical_notes,
        internalFlags: updatedMember.internal_flags,
        createdAt: updatedMember.created_at,
        updatedAt: updatedMember.updated_at
      }
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Update member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
  }
})

// Update member waiver status (admin endpoint)
app.patch('/api/admin/members/:id/waivers', async (req, res) => {
  try {
    const { id } = req.params
    const { hasCompletedWaivers, waiverCompletionDate } = req.body
    
    if (typeof hasCompletedWaivers !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'hasCompletedWaivers must be a boolean'
      })
    }
    
    // Update waiver status
    await pool.query(`
      UPDATE member
      SET has_completed_waivers = $1,
          waiver_completion_date = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [hasCompletedWaivers, waiverCompletionDate || (hasCompletedWaivers ? new Date() : null), id])
    
    // Update athlete status (will check enrollments + waivers)
    await updateMemberAthleteStatus(parseInt(id))
    
    res.json({
      success: true,
      message: 'Waiver status updated successfully'
    })
  } catch (error) {
    console.error('Update waiver status error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update parent/guardian relationships (admin endpoint)
app.put('/api/admin/members/:id/parent-guardians', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    const { id } = req.params
    const { parentGuardianIds } = req.body
    
    if (!Array.isArray(parentGuardianIds)) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'parentGuardianIds must be an array'
      })
    }
    
    // Check if member exists and is a child
    const memberCheck = await client.query('SELECT id, date_of_birth FROM member WHERE id = $1', [id])
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      })
    }
    
    const member = memberCheck.rows[0]
    const isChild = member.date_of_birth && !isAdult(member.date_of_birth)
    
    if (!isChild) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Parent/guardian relationships can only be set for children (under 18)'
      })
    }
    
    // Validate parent guardians if provided
    if (parentGuardianIds.length > 0) {
      const validation = await validateParentGuardians(parentGuardianIds)
      if (!validation.valid) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: validation.error
        })
      }
    }
    
    // Update member's parent_guardian_ids
    await client.query(`
      UPDATE member
      SET parent_guardian_ids = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [parentGuardianIds.length > 0 ? parentGuardianIds : null, id])
    
    // Update parent_guardian_authority table
    try {
      // Delete existing relationships
      await client.query(`
        DELETE FROM parent_guardian_authority WHERE child_member_id = $1
      `, [id])
      
      // Add new relationships
      if (parentGuardianIds.length > 0) {
        for (const parentId of parentGuardianIds) {
          await client.query(`
            INSERT INTO parent_guardian_authority (parent_member_id, child_member_id, has_legal_authority)
            VALUES ($1, $2, TRUE)
            ON CONFLICT (parent_member_id, child_member_id) DO UPDATE
            SET has_legal_authority = TRUE, updated_at = NOW()
          `, [parentId, id])
        }
      }
    } catch (pgError) {
      console.warn('Error updating parent_guardian_authority:', pgError.message)
    }
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: 'Parent/guardian relationships updated successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Update parent/guardian relationships error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  } finally {
    client.release()
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
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE fm.family_id = $1
        AND fm.is_active = TRUE
        AND m.id != $2
        AND m.date_of_birth IS NOT NULL
    `, [familyId, memberId])
    
    // Check remaining adult members after removal.
    const remainingAdults = await pool.query(`
      SELECT COUNT(*) as count
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE fm.family_id = $1
        AND fm.is_active = TRUE
        AND m.id != $2
        AND m.date_of_birth IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(m.date_of_birth)) >= 18
    `, [familyId, member.id])
    
    const adultCount = parseInt(remainingAdults.rows[0].count || '0')
    const payerCheck = await pool.query(`
      SELECT payer_member_id
      FROM family_billing_account
      WHERE family_id = $1 AND is_active = TRUE
    `, [familyId])
    const currentPayerMemberId = payerCheck.rows.length > 0 ? payerCheck.rows[0].payer_member_id : null
    
    // Check if any remaining children will be left without guardians
    const willLeaveChildrenOrphaned = childrenInFamily.rows.some(child => {
      const childAge = parseInt(child.age)
      return childAge < 18 && adultCount === 0
    })
    
    // If adult: create their own family
    if (isAdult && member.id) {
      await pool.query(`
        UPDATE family_member
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE family_id = $1 AND member_id = $2
      `, [familyId, member.id])
      
      // Create new family for the adult
      const newFamilyResult = await pool.query(`
        INSERT INTO family (facility_id, family_name)
        VALUES ($1, $2)
        RETURNING *
      `, [facilityId, `${member.first_name} ${member.last_name} Family`])
      
      const newFamilyId = newFamilyResult.rows[0].id
      await moveMemberToFamily(member.id, newFamilyId)
      await pool.query(`
        INSERT INTO family_billing_account (
          family_id,
          payer_member_id,
          billing_email,
          billing_phone,
          billing_street,
          billing_city,
          billing_state,
          billing_zip
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (family_id) DO UPDATE
        SET payer_member_id = EXCLUDED.payer_member_id,
            billing_email = EXCLUDED.billing_email,
            billing_phone = EXCLUDED.billing_phone,
            billing_street = EXCLUDED.billing_street,
            billing_city = EXCLUDED.billing_city,
            billing_state = EXCLUDED.billing_state,
            billing_zip = EXCLUDED.billing_zip,
            is_active = TRUE,
            updated_at = CURRENT_TIMESTAMP
      `, [
        newFamilyId,
        member.id,
        member.email,
        member.phone,
        member.billing_street,
        member.billing_city,
        member.billing_state,
        member.billing_zip,
      ])

      if (Number(currentPayerMemberId) === Number(member.id)) {
        const replacementPayer = await pool.query(`
          SELECT m.id
          FROM family_member fm
          JOIN member m ON m.id = fm.member_id
          WHERE fm.family_id = $1
            AND fm.is_active = TRUE
            AND m.is_active = TRUE
          ORDER BY (m.email IS NULL), m.id
          LIMIT 1
        `, [familyId])
        await pool.query(`
          UPDATE family_billing_account
          SET payer_member_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE family_id = $2 AND is_active = TRUE
        `, [replacementPayer.rows[0]?.id ?? null, familyId])
      }
      
      // If removing this adult leaves children without guardians, orphan those children
      if (willLeaveChildrenOrphaned) {
        for (const child of childrenInFamily.rows) {
          const childAge = child.age != null ? parseInt(child.age) : null
          if (childAge !== null && childAge < 18) {
            await pool.query(`
              UPDATE family_member
              SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
              WHERE family_id = $1 AND member_id = $2
            `, [familyId, child.id])
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
        UPDATE family_member
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE family_id = $1 AND member_id = $2
      `, [familyId, memberId])
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

// Delete member (admin endpoint) - master admins only.
// Regular admins can archive members but cannot permanently delete them.
app.delete('/api/admin/members/:id', async (req, res) => {
  if (req.isMasterAdmin !== true) {
    return res.status(403).json({
      success: false,
      message: 'Only master admins can permanently delete members.',
    })
  }

  const { id } = req.params

  if (await isDefaultMasterMemberId(id)) {
    return res.status(400).json({
      success: false,
      message: 'The default master admin account cannot be deleted.',
    })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Capture the linked login account before removing the member row.
    const memberResult = await client.query(
      'SELECT app_user_id FROM member WHERE id = $1',
      [id],
    )
    if (memberResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, message: 'Member not found' })
    }
    const appUserId = memberResult.rows[0].app_user_id

    // Remove the member; FK rules (CASCADE / SET NULL) clean up dependents
    // such as scheduling signups, waivers, schools, and family links.
    await client.query('DELETE FROM member WHERE id = $1', [id])

    // Delete the linked login account only when it is a member-only account
    // that no longer backs any other member record.
    if (appUserId) {
      const otherMembers = await client.query(
        'SELECT COUNT(*)::int AS count FROM member WHERE app_user_id = $1',
        [appUserId],
      )
      if (otherMembers.rows[0].count === 0) {
        const rolesResult = await client.query(
          `
            SELECT role_key FROM (
              SELECT role::text AS role_key FROM app_user WHERE id = $1
              UNION
              SELECT role::text AS role_key FROM app_user_role WHERE user_id = $1
            ) roles
          `,
          [appUserId],
        )
        const roles = rolesResult.rows.map((row) => row.role_key)
        const memberOnly = roles.length > 0 && roles.every((role) => role === 'MEMBER_ATHLETE')
        // Master admins can fully remove the login account when deleting a member,
        // even when the account also holds coach/admin roles.
        if (memberOnly || req.isMasterAdmin === true) {
          await client.query('DELETE FROM app_user WHERE id = $1', [appUserId])
        }
      }
    }

    await client.query('COMMIT')
    res.json({
      success: true,
      message: 'Member deleted successfully',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Delete member error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  } finally {
    client.release()
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
          LEFT JOIN app_user_role ur ON ur.user_id = u.id
          WHERE (u.facility_id = $1 OR u.facility_id IS NULL)
            AND u.email = $2 
            AND (u.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN')
                 OR ur.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN'))
            AND u.is_active = TRUE
        `
        params = [facilityId, emailOrUsername]
      } else {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN app_user_role ur ON ur.user_id = u.id
          WHERE u.email = $1 
            AND (u.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN')
                 OR ur.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN'))
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
          LEFT JOIN app_user_role ur ON ur.user_id = u.id
          WHERE (u.facility_id = $1 OR u.facility_id IS NULL)
            AND u.username IS NOT NULL
            AND LOWER(u.username) = $2 
            AND (u.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN')
                 OR ur.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN'))
            AND u.is_active = TRUE
        `
        params = [facilityId, usernameLower]
      } else {
        query = `
          SELECT DISTINCT u.* 
          FROM app_user u
          LEFT JOIN app_user_role ur ON ur.user_id = u.id
          WHERE u.username IS NOT NULL
            AND LOWER(u.username) = $1 
            AND (u.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN')
                 OR ur.role::text IN ('MEMBER_ATHLETE', 'COACH', 'ADMIN', 'MASTER_ADMIN'))
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

    // Get user's family through the canonical member -> app_user -> family_member path.
    let familyContext = null
    try {
      familyContext = await getUserFamilyContext(user.id)
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
    }

    // Get all user roles FIRST (includes roles from user_role junction table)
    // This is needed to check if user is guardian or admin
    const allUserRoles = await getUserRoles(user.id)
    const linkedMember = await getMemberForAppUser(user.id)

    // Get user's family members if they're a guardian or admin with family
    // Note: This includes admin users (MASTER_ADMIN / ADMIN) who may also be members
    // SECURITY: Only the admin user themselves gets admin portal access, not family members
    let familyMembers = []
    const adminRoles = ['MASTER_ADMIN', 'ADMIN']
    const memberPortalRoles = ['MEMBER_ATHLETE']
    const isAdminUser = adminRoles.includes(user.role) || allUserRoles.some((role) => adminRoles.includes(role))
    const isCoachUser = user.role === 'COACH' || allUserRoles.includes('COACH')
    const hasMemberPortal = memberPortalRoles.includes(user.role) || allUserRoles.some((role) => memberPortalRoles.includes(role))
    const isGuardianOrAdmin = hasMemberPortal || isAdminUser
    
    if ((isGuardianOrAdmin || hasMemberPortal) && familyContext) {
      try {
        const membersResult = await pool.query(`
          SELECT m.id, m.first_name, m.last_name, m.date_of_birth, m.status
          FROM family_member fm
          JOIN member m ON m.id = fm.member_id
          WHERE fm.family_id = $1
            AND fm.is_active = TRUE
            AND m.is_active = TRUE
          `, [familyContext.id])
        familyMembers = membersResult.rows
      } catch (memberError) {
        console.log('Member query failed (non-critical):', memberError.message)
        // Continue without member data
        familyMembers = []
      }
    }
    
    // Generate JWT token with all roles
    // SECURITY NOTE: Including adminId here allows this SPECIFIC user to access admin portal
    // This does NOT grant admin portal access to family members because:
    // 1. Family members have different user IDs
    // 2. authenticateAdmin middleware verifies the SPECIFIC user's role by checking their user ID
    // 3. Only users with an admin role (MASTER_ADMIN / ADMIN) get adminId in their token
    const tokenPayload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role, 
      roles: allUserRoles 
    }
    
    // Include adminId for any admin-capable account so one token can switch portals.
    if (isAdminUser) {
      tokenPayload.adminId = user.id
    }
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' })

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
      roles: allUserRoles, // All roles (may include MASTER_ADMIN / ADMIN for admins)
      memberId: familyContext?.current_member_id ?? null,
      isAdmin: isAdminUser,
      isCoach: isCoachUser,
      hasMemberPortal,
      availablePortals: [
        ...(hasMemberPortal || familyContext ? ['member'] : []),
        ...(isCoachUser ? ['coach'] : []),
        ...(isAdminUser ? ['admin'] : []),
      ],
      familyId: familyContext?.id ?? null,
      familyName: familyContext?.family_name ?? null,
      payerMemberId: familyContext?.payer_member_id ?? null,
      mustChangePassword: linkedMember?.must_change_password === true,
      familyMembers: familyMembers.map(m => ({
        id: m.id,
        firstName: m.first_name || '',
        lastName: m.last_name || '',
        dateOfBirth: m.date_of_birth || null,
        status: m.status || 'legacy'
      }))
    }
    
    // Log if admin is logging in via member portal
    if (isAdminUser || isCoachUser) {
      console.log('[Member Login] Multi-role user logged in via member portal:', {
        userId: user.id,
        email: user.email,
        roles: allUserRoles,
        familyId: familyContext?.id ?? null,
        availablePortals: memberData.availablePortals,
      })
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

app.post('/api/members/request-password-reset', async (req, res) => {
  try {
    const { error, value } = memberPasswordResetRequestSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error' })
    }

    const normalizedEmail = value.email.trim().toLowerCase()
    const userResult = await pool.query(`
      SELECT id, email, full_name
      FROM app_user
      WHERE LOWER(email) = $1
        AND is_active = TRUE
      LIMIT 1
    `, [normalizedEmail])

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0]
      const temporaryPassword = generateTemporaryPassword(12)
      const passwordHash = await bcrypt.hash(temporaryPassword, 10)
      await pool.query(
        `UPDATE app_user SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id, passwordHash],
      )
      await pool.query(
        `UPDATE member SET must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP WHERE app_user_id = $1`,
        [user.id],
      )
      try {
        await sendTemporaryPasswordEmail({
          registrantFirstName: String(user.full_name || '').split(' ')[0] || 'there',
          registrantEmail: user.email,
          temporaryPassword,
        })
      } catch (mailError) {
        console.error('Member password reset email failed:', mailError.message)
      }
    }

    // Return generic success regardless of lookup result.
    res.json({
      success: true,
      message: 'If an account exists for that email, a temporary password has been sent.',
    })
  } catch (error) {
    console.error('Member password reset request error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

app.post('/api/members/change-password', authenticateMember, async (req, res) => {
  try {
    const { error, value } = memberChangePasswordSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error' })
    }

    const userId = req.userId || req.memberId
    const userResult = await pool.query(
      `SELECT id, password_hash FROM app_user WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [userId],
    )
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const current = userResult.rows[0]
    const isValid = await bcrypt.compare(value.currentPassword, current.password_hash || '')
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' })
    }

    const newHash = await bcrypt.hash(value.newPassword, 10)
    await pool.query(
      `UPDATE app_user SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId, newHash],
    )
    await pool.query(
      `UPDATE member SET must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP WHERE app_user_id = $1`,
      [userId],
    )

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Member change password error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Get current member and their family (protected endpoint) - uses same query structure as admin members
app.get('/api/members/me', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    
    // Check if member table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    
    if (!hasMemberTable) {
      return res.status(404).json({
        success: false,
        message: 'Member table not found'
      })
    }
    
    // First, get the app_user account for role and fallback matching.
    let currentAppUser = null
    try {
      const userResult = await pool.query('SELECT id, email, role::text as role FROM app_user WHERE id = $1', [userId])
      if (userResult.rows.length > 0) {
        currentAppUser = userResult.rows[0]
      }
    } catch (userError) {
      console.log('User email query failed:', userError.message)
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    if (!currentAppUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    // Find the member record linked to this app_user. Email matching is retained as a fallback.
    const memberQuery = `
      SELECT 
        m.id,
        m.app_user_id,
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
        m.profile_complete,
        m.signup_source,
        m.gender,
        m.medical_concerns,
        m.injury_history_date,
        m.injury_history_body_part,
        m.injury_history_notes,
        m.no_injury_history,
        m.created_at,
        m.updated_at,
        f.family_name,
        CASE WHEN m.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
          ELSE NULL 
        END as age
      FROM member m
      LEFT JOIN family f ON m.family_id = f.id
      WHERE m.is_active = TRUE
        AND (
          m.app_user_id = $1
          OR (m.app_user_id IS NULL AND m.id = $1)
          OR (m.app_user_id IS NULL AND m.email = $2)
        )
      ORDER BY CASE WHEN m.app_user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `
    
    let memberResult = await pool.query(memberQuery, [userId, currentAppUser.email])

    if (memberResult.rows.length === 0) {
      await ensureMemberForAppUser(userId)
      memberResult = await pool.query(memberQuery, [userId, currentAppUser.email])
    }

    if (memberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found for user'
      })
    }
    
    const currentMemberRow = memberResult.rows[0]
    const familyId = currentMemberRow.family_id
    
    // Get all family members if family exists, otherwise just return the single member
    let allMembers = [currentMemberRow]
    if (familyId) {
      const familyResult = await pool.query(
        `
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
        LEFT JOIN family f ON f.id = m.family_id
        WHERE m.is_active = TRUE
          AND (
            m.family_id = $1
            OR m.id IN (
              SELECT fm.member_id
              FROM family_member fm
              WHERE fm.family_id = $1 AND fm.is_active = TRUE
            )
          )
        ORDER BY m.last_name, m.first_name
        `,
        [familyId],
      )
      if (familyResult.rows.length > 0) {
        allMembers = familyResult.rows
      }
    }
    
    const result = { rows: allMembers }
    
    // Get member IDs for fetching roles and enrollments
    const memberIds = result.rows.map(row => row.id)
    
    // Get enrollments (same as admin endpoint)
    let enrollmentsMap = {}
    if (memberIds.length > 0) {
      try {
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
      } catch (enrollmentsError) {
        console.log('Enrollments query failed (non-critical):', enrollmentsError.message)
        enrollmentsMap = {}
      }
    }
    
    // Get roles from canonical app_user/app_user_role records.
    let rolesMap = {}
    try {
      if (memberIds.length > 0) {
        const rolesResult = await pool.query(`
          SELECT
            m.id as member_id,
            json_agg(DISTINCT jsonb_build_object('id', role_key, 'role', role_key)) as roles
          FROM member m
          JOIN app_user au ON au.id = m.app_user_id
          CROSS JOIN LATERAL (
            SELECT au.role::text as role_key
            UNION
            SELECT aur.role::text as role_key
            FROM app_user_role aur
            WHERE aur.user_id = au.id
          ) roles
          WHERE m.id = ANY($1::bigint[])
          GROUP BY m.id
        `, [memberIds])
        rolesResult.rows.forEach(row => {
          rolesMap[row.member_id] = row.roles || []
        })
      }
    } catch (rolesError) {
      console.log('Roles query failed (non-critical):', rolesError.message)
    }
    
    // Format members (same as admin endpoint)
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
      profileComplete: row.profile_complete !== false,
      signupSource: row.signup_source,
      gender: row.gender,
      medicalConcerns: row.medical_concerns,
      injuryHistoryDate: row.injury_history_date,
      injuryHistoryBodyPart: row.injury_history_body_part,
      injuryHistoryNotes: row.injury_history_notes,
      noInjuryHistory: row.no_injury_history,
      roles: rolesMap[row.id] || [],
      enrollments: enrollmentsMap[row.id] || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    // Current user is the linked member. Sort family members so that record is first.
    members.sort((a, b) => {
      if (a.id === currentMemberRow.id) return -1
      if (b.id === currentMemberRow.id) return 1
      return 0
    })
    
    const currentUser = members[0]
    const accountRoles = await getUserRoles(userId)
    const adminRoles = ['MASTER_ADMIN', 'ADMIN']
    const memberPortalRoles = ['MEMBER_ATHLETE']
    const isAdminUser = adminRoles.includes(currentAppUser.role) || accountRoles.some((role) => adminRoles.includes(role))
    const isCoachUser = currentAppUser.role === 'COACH' || accountRoles.includes('COACH')
    const hasMemberPortal = memberPortalRoles.includes(currentAppUser.role) || accountRoles.some((role) => memberPortalRoles.includes(role))
    const familyContext = await getUserFamilyContext(userId).catch(() => null)
    currentUser.roles = currentUser.roles?.length ? currentUser.roles : accountRoles.map((role) => ({ id: role, role }))
    currentUser.memberId = currentMemberRow.id
    currentUser.payerMemberId = familyContext?.payer_member_id ?? null
    currentUser.isFamilyPayer = familyContext?.payer_member_id != null && Number(familyContext.payer_member_id) === Number(currentMemberRow.id)
    currentUser.availablePortals = [
      ...(hasMemberPortal || familyContext ? ['member'] : []),
      ...(isCoachUser ? ['coach'] : []),
      ...(isAdminUser ? ['admin'] : []),
    ]
    
    // All other members are family members (if any)
    const familyMembersList = members.length > 1 ? members.slice(1) : []
    
    res.json({
      success: true,
      member: currentUser,
      data: currentUser,
      familyMembers: familyMembersList
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
      WHERE u.id = $1 AND u.is_active = TRUE
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

    // Get user's family through member.app_user_id + family_member.
    let familyContext = null
    try {
      familyContext = await getUserFamilyContext(userId)
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
      // Return empty family members if family table doesn't exist
      return res.json({
        success: true,
        familyMembers: []
      })
    }

    if (!familyContext) {
      return res.json({
        success: true,
        familyMembers: []
      })
    }

    const familyId = familyContext.id

    // Get all family members using unified member table
    let guardiansResult = { rows: [] }
    try {
      guardiansResult = await pool.query(`
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          m.phone,
          au.id as app_user_id,
          CASE 
            WHEN m.status = 'enrolled' THEN 'ATHLETE'
            WHEN au.role IS NOT NULL THEN au.role::text
            ELSE 'MEMBER'
          END as role,
          CASE WHEN fba.payer_member_id = m.id THEN TRUE ELSE FALSE END as is_primary,
          CASE WHEN m.email IS NOT NULL OR au.id IS NOT NULL THEN TRUE ELSE FALSE END as is_adult,
          m.date_of_birth,
          CASE WHEN m.date_of_birth IS NOT NULL 
            THEN EXTRACT(YEAR FROM AGE(m.date_of_birth))::INTEGER 
            ELSE NULL 
          END as age,
          COALESCE(au.id, m.app_user_id, m.id) as user_id,
          FALSE as marked_for_removal
        FROM family_member fm
        JOIN member m ON m.id = fm.member_id
        LEFT JOIN app_user au ON au.id = m.app_user_id
        LEFT JOIN family_billing_account fba ON fba.family_id = fm.family_id AND fba.is_active = TRUE
        WHERE fm.family_id = $1
          AND fm.is_active = TRUE
          AND m.is_active = TRUE
        ORDER BY is_primary DESC, m.last_name, m.first_name
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
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email,
      phone: row.phone,
      date_of_birth: row.date_of_birth,
      age: row.age,
      user_id: row.user_id,
      app_user_id: row.app_user_id,
      is_primary: row.is_primary,
      is_adult: row.date_of_birth ? isAdult(row.date_of_birth) : (row.is_adult === true),
      athlete_type: row.date_of_birth ? (isAdult(row.date_of_birth) ? 'adult' : 'youth') : null,
      is_family_rep: row.is_primary === true,
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

// Add a family member from the member portal.
app.post('/api/members/family', authenticateMember, async (req, res) => {
  const client = await pool.connect()
  try {
    const userId = req.userId || req.memberId
    const hasParentRole = await userIsAdult(userId)
    if (!hasParentRole) {
      return res.status(403).json({ success: false, message: 'Only adults can add family members' })
    }

    const firstName = String(req.body?.first_name || req.body?.firstName || '').trim()
    const lastName = String(req.body?.last_name || req.body?.lastName || '').trim()
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'First and last name are required' })
    }

    await client.query('BEGIN')

    const familyContext = await ensureUserFamilyContext(userId, client)
    if (!familyContext) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, message: 'Could not resolve or create a family for your account' })
    }

    const currentMember = await getMemberForAppUser(userId, client)
    const facilityId = familyContext.facility_id ?? currentMember?.facility_id
    if (!facilityId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, message: 'Could not resolve facility for this family' })
    }

    const createdMember = await createPortalFamilyMember(client, {
      facilityId,
      familyId: familyContext.id,
      payerMember: currentMember,
      input: {
        firstName,
        lastName,
        email: req.body?.email,
        phone: req.body?.phone,
        dateOfBirth: req.body?.date_of_birth || req.body?.dateOfBirth,
      },
    })

    await client.query('COMMIT')

    const newMemberId = createdMember.id
    void notifyWelcomeNewMember(pool, newMemberId, { context: 'portal_add_family' })
    void notifyFamilyGuardiansNewMember(pool, {
      familyId: familyContext.id,
      newMemberId,
      addedByUserId: userId,
    })

    res.json({ success: true, data: createdMember })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Create member family member error:', error)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A member with this email already exists. Leave email blank for a child using your contact info.',
      })
    }
    if (error.message && typeof error.message === 'string') {
      return res.status(400).json({ success: false, message: error.message })
    }
    res.status(500).json({ success: false, message: 'Internal server error' })
  } finally {
    client.release()
  }
})

// Update family member
app.put('/api/members/family/:id', authenticateMember, async (req, res) => {
  try {
    const userId = req.userId || req.memberId
    const familyMemberId = parseInt(req.params.id)
    const { first_name, last_name, email, phone } = req.body

    // Check if user is an adult (has PARENT_GUARDIAN role)
    const hasParentRole = await userIsAdult(userId)
    
    if (!hasParentRole) {
      return res.status(403).json({
        success: false,
        message: 'Only adults can edit family member information'
      })
    }

    // Check if family member exists and belongs to user's family via family_member.
    const familyContext = await getUserFamilyContext(userId)

    if (!familyContext) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      })
    }

    const familyId = familyContext.id

    // Check if it's a member
    const memberCheck = await pool.query(`
      SELECT m.id
      FROM family_member fm
      JOIN member m ON m.id = fm.member_id
      WHERE m.id = $1
        AND fm.family_id = $2
        AND fm.is_active = TRUE
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
        await refreshMemberProfileComplete(pool, familyMemberId)
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

    // Check if user is an adult (derived from date of birth, not role)
    const userResult = await pool.query(`
      SELECT u.role
      FROM app_user u
      WHERE u.id = $1
    `, [userId])

    if (userResult.rows.length === 0 || !(await userIsAdult(userId))) {
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
      SELECT m.id, m.app_user_id, m.first_name, m.last_name, m.family_id, m.email, m.status, m.is_active
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

      const isParentGuardian = await userIsAdult(userId)
      
      // Check if the user is the member or is part of the member's family.
      let isFamilyMember = false
      if (member.id === userId || member.app_user_id === userId) {
        isFamilyMember = true
      }
      if (member.family_id) {
        isFamilyMember = isFamilyMember || await userHasFamilyAccess(userId, member.family_id)
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
    // First, ensure the table exists (create if it doesn't)
    try {
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
      
      // Create indexes if they don't exist
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_member ON member_program(member_id)`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_program ON member_program(program_id)`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_iteration ON member_program(iteration_id)`)
    } catch (tableError) {
      // If table creation fails, log but continue - might already exist
      console.warn('[Enrollment] Could not ensure member_program table exists:', tableError.message)
    }
    
    // Now insert the enrollment record
    let memberProgramId = null
    try {
      const selectedDaysJson = JSON.stringify(selectedDays)
      
      const enrollInsert = await pool.query(`
        INSERT INTO member_program (member_id, program_id, iteration_id, days_per_week, selected_days, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (member_id, program_id, iteration_id) DO UPDATE
        SET days_per_week = $4, selected_days = $5::jsonb, updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [member.id, programId, iterationId, daysPerWeek, selectedDaysJson])
      memberProgramId = enrollInsert.rows[0]?.id
    } catch (error) {
      console.error('Error creating enrollment record:', error)
      console.error('Error stack:', error.stack)
      return res.status(500).json({
        success: false,
        message: 'Failed to create enrollment record: ' + (error.message || 'Unknown error'),
        error: process.env.NODE_ENV !== 'production' ? error.message : undefined
      })
    }

    // Update member athlete status (will check enrollments + waivers)
    await updateMemberAthleteStatus(member.id)

    // Optional launch billing hook: enrollments can immediately generate a ledger charge.
    const chargeAmountCents = Number(req.body?.chargeAmountCents ?? 0)
    if (member.family_id && Number.isFinite(chargeAmountCents) && chargeAmountCents > 0) {
      try {
        await pool.query(`
          INSERT INTO family_billing_account (family_id, payer_member_id, is_active)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (family_id) DO NOTHING
        `, [member.family_id, member.id])

        const accountResult = await pool.query(
          `SELECT id FROM family_billing_account WHERE family_id = $1 LIMIT 1`,
          [member.family_id],
        )
        const accountId = accountResult.rows[0]?.id
        if (accountId) {
          await pool.query(`
            INSERT INTO billing_charge (family_billing_account_id, member_id, description, amount_cents)
            VALUES ($1, $2, $3, $4)
          `, [
            accountId,
            member.id,
            req.body?.chargeDescription || `Enrollment charge: ${programCheck.rows[0].display_name}`,
            chargeAmountCents,
          ])
        }
      } catch (billingError) {
        console.warn('[Enrollment] Billing charge creation failed:', billingError.message)
      }
    }

    // Best-effort enrollment receipt email (never blocks enrollment).
    const slotLabel =
      iteration.start_time && iteration.end_time
        ? `${selectedDays.join(', ')} · ${iteration.start_time}–${iteration.end_time}`
        : selectedDays.join(', ')
    void notifyEnrollmentReceipt(pool, {
      memberId: member.id,
      programName: programCheck.rows[0].display_name,
      slotLabel,
      status: 'confirmed',
      selectedDays,
      memberProgramId,
    })

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
      const hasParentRole = await userIsAdult(userId)
      
      // Check if user is the member or part of the member's family.
      let isFamilyMember = false
      if (memberId === userId) {
        isFamilyMember = true
      }
      if (enrollment.family_id) {
        isFamilyMember = isFamilyMember || await userHasFamilyAccess(userId, enrollment.family_id)
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
    
    // Update member athlete status (will check enrollments + waivers)
    await updateMemberAthleteStatus(memberId)
    
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

    let familyContext = null
    try {
      familyContext = await ensureUserFamilyContext(userId)
    } catch (familyError) {
      console.log('Family query failed (non-critical):', familyError.message)
    }

    if (!familyContext) {
      const member = await getMemberForAppUser(userId)
      if (!member) {
        return res.json({ success: true, enrollments: [] })
      }
      try {
        const enrollments = await queryFamilyMemberEnrollments(pool, [member.id])
        return res.json({ success: true, enrollments })
      } catch (enrollmentError) {
        console.log('Enrollment query failed (non-critical):', enrollmentError.message)
        return res.json({ success: true, enrollments: [] })
      }
    }

    const memberIds = await listActiveFamilyMemberIds(pool, familyContext.id, {
      fallbackMemberId: familyContext.current_member_id,
    })

    if (memberIds.length === 0) {
      return res.json({ success: true, enrollments: [] })
    }

    try {
      const enrollments = await queryFamilyMemberEnrollments(pool, memberIds)
      res.json({ success: true, enrollments })
    } catch (enrollmentError) {
      console.log('Enrollment query failed (non-critical):', enrollmentError.message)
      res.json({ success: true, enrollments: [] })
    }
  } catch (error) {
    console.error('Get enrollments error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get programs for members (member-accessible endpoint)
app.get('/api/members/programs', authenticateMember, async (req, res) => {
  try {
    // Members only see active, non-archived programs
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
      WHERE p.archived = FALSE AND p.is_active = TRUE
    `
    
    query += ' ORDER BY pc.display_name ASC, p.skill_level NULLS LAST, p.display_name'

    const result = await pool.query(query)

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

// Get categories for members (member-accessible endpoint)
app.get('/api/members/categories', authenticateMember, async (req, res) => {
  try {
    // Members only see active, non-archived categories
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
      WHERE archived = FALSE
    `
    
    query += ' ORDER BY display_name ASC'
    
    const result = await pool.query(query)

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

// Get program iterations for members (member-accessible endpoint)
app.get('/api/members/programs/:programId/iterations', authenticateMember, async (req, res) => {
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
    
    let result
    try {
      result = await pool.query(`
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
    } catch (queryError) {
      // If column doesn't exist, try to add it and retry
      if (queryError.code === '42703' && queryError.message.includes('time_blocks')) {
        console.log('time_blocks column missing, adding it now...')
        try {
          await pool.query(`
            ALTER TABLE class_iteration ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT NULL
          `)
          console.log('✅ Added time_blocks column, retrying query...')
          // Retry the query
          result = await pool.query(`
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
        } catch (alterError) {
          console.error('Error adding time_blocks column:', alterError)
          return res.json({
            success: true,
            data: [],
            warning: 'Could not add time_blocks column'
          })
        }
      } else {
        // If table doesn't exist, return empty array
        if (queryError.message && (queryError.message.includes('does not exist') || (queryError.message.includes('relation') && queryError.message.includes('class_iteration')))) {
          return res.json({
            success: true,
            data: [],
            warning: 'class_iteration table not found'
          })
        }
        throw queryError
      }
    }
    
    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Get program iterations error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// ========== HIGHLIGHT HELPERS ==========

const parseEventJsonFields = (event) => {
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
    console.error('Error parsing event JSON fields:', e)
  }
  return {
    datesAndTimes: Array.isArray(datesAndTimes) ? datesAndTimes : [],
    keyDetails: Array.isArray(keyDetails) ? keyDetails : [],
    images: Array.isArray(images) ? images : [],
  }
}

const parseLocalEventDate = (dateStr) => {
  if (!dateStr) return undefined
  if (dateStr instanceof Date) return dateStr
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatEventForHighlight = (event) => {
  if (!event || !event.id) return null
  const { datesAndTimes, keyDetails, images } = parseEventJsonFields(event)
  return {
    id: event.id,
    eventName: event.eventName,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
    startDate: parseLocalEventDate(event.startDate),
    endDate: event.endDate ? parseLocalEventDate(event.endDate) : undefined,
    type: event.type,
    address: event.address,
    datesAndTimes: Array.isArray(datesAndTimes)
      ? datesAndTimes.map((dt) => ({
          ...dt,
          date: parseLocalEventDate(dt.date),
        }))
      : [],
    keyDetails,
    images,
  }
}

const mapHighlightRow = (row) => {
  let siteKeys = []
  let customContent = null
  try {
    siteKeys = typeof row.siteKeys === 'string' ? JSON.parse(row.siteKeys) : (row.siteKeys || [])
    customContent = typeof row.customContent === 'string'
      ? JSON.parse(row.customContent)
      : (row.customContent || null)
  } catch (e) {
    console.error('Error parsing highlight JSON fields:', e)
  }

  const highlight = {
    id: row.id,
    title: row.title,
    contentType: row.contentType,
    eventId: row.eventId,
    documentMime: row.documentMime,
    documentData: row.documentData,
    customContent,
    siteKeys: Array.isArray(siteKeys) ? siteKeys : [],
    displayFrequency: row.displayFrequency,
    published: row.published,
    sortOrder: row.sortOrder,
    buttonEnabled: row.buttonEnabled ?? false,
    buttonLabel: row.buttonLabel ?? null,
    buttonUrl: row.buttonUrl ?? null,
    buttonTextAbove: row.buttonTextAbove ?? null,
    buttonTextBelow: row.buttonTextBelow ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  if (row.eventName !== undefined && row.eventName !== null) {
    highlight.event = formatEventForHighlight({
      id: row.eventId,
      eventName: row.eventName,
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
      startDate: row.startDate,
      endDate: row.endDate,
      type: row.type,
      address: row.address,
      datesAndTimes: row.datesAndTimes,
      keyDetails: row.keyDetails,
      images: row.images,
    })
  }

  return highlight
}

const estimateBase64Bytes = (data) => {
  if (!data || typeof data !== 'string') return 0
  const base64 = data.includes(',') ? data.split(',')[1] : data
  return Math.floor((base64.length * 3) / 4)
}

const validateHighlightButton = (value) => {
  if (!value.buttonEnabled) {
    return { error: null }
  }
  const url = (value.buttonUrl || '').trim()
  if (!url) {
    return { error: 'buttonUrl is required when action button is enabled' }
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'Button link must start with http:// or https://' }
    }
  } catch {
    return { error: 'Button link must be a valid URL' }
  }
  return { error: null }
}

const validateHighlightContent = async (value, highlightId = null) => {
  const { contentType, eventId, documentMime, documentData, customContent } = value

  if (contentType === 'event') {
    if (!eventId) {
      return { error: 'eventId is required for event highlights' }
    }
    const eventCheck = await pool.query('SELECT id FROM events WHERE id = $1', [eventId])
    if (eventCheck.rows.length === 0) {
      return { error: 'Event not found' }
    }
  }

  if (contentType === 'document') {
    if (!documentMime || !documentData) {
      return { error: 'documentMime and documentData are required for document highlights' }
    }
    const bytes = estimateBase64Bytes(documentData)
    if (bytes > HIGHLIGHT_DOCUMENT_MAX_BYTES) {
      return { error: `Document exceeds maximum size of ${HIGHLIGHT_DOCUMENT_MAX_BYTES / (1024 * 1024)}MB` }
    }
  }

  if (contentType === 'custom') {
    if (!customContent) {
      return { error: 'customContent is required for custom highlights' }
    }
  }

  return { error: null }
}

const HIGHLIGHT_SELECT = `
  SELECT
    h.id,
    h.title,
    h.content_type as "contentType",
    h.event_id as "eventId",
    h.document_mime as "documentMime",
    h.document_data as "documentData",
    h.custom_content as "customContent",
    h.site_keys as "siteKeys",
    h.display_frequency as "displayFrequency",
    h.published,
    h.sort_order as "sortOrder",
    h.button_enabled as "buttonEnabled",
    h.button_label as "buttonLabel",
    h.button_url as "buttonUrl",
    h.button_text_above as "buttonTextAbove",
    h.button_text_below as "buttonTextBelow",
    h.created_at as "createdAt",
    h.updated_at as "updatedAt",
    e.event_name as "eventName",
    e.short_description as "shortDescription",
    e.long_description as "longDescription",
    e.start_date as "startDate",
    e.end_date as "endDate",
    e.type,
    e.address,
    e.dates_and_times as "datesAndTimes",
    e.key_details as "keyDetails",
    e.images
  FROM highlights h
  LEFT JOIN events e ON h.event_id = e.id
`

// ========== EVENT ENDPOINTS ==========

// Get all events (public endpoint for ReadBoard)
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.event_name as "eventName",
        e.short_description as "shortDescription",
        e.long_description as "longDescription",
        e.start_date as "startDate",
        e.end_date as "endDate",
        e.type,
        e.address,
        e.dates_and_times as "datesAndTimes",
        e.key_details as "keyDetails",
        e.images,
        e.tag_type as "tagType",
        e.tag_class_ids as "tagClassIds",
        e.tag_category_ids as "tagCategoryIds",
        e.tag_all_parents as "tagAllParents",
        e.tag_boosters as "tagBoosters",
        e.tag_volunteers as "tagVolunteers",
        e.scheduling_form_id as "schedulingFormId",
        sf.title as "schedulingFormTitle",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM events e
      LEFT JOIN scheduling_form sf ON sf.id = e.scheduling_form_id
      WHERE e.archived = FALSE OR e.archived IS NULL
      ORDER BY e.start_date ASC, e.created_at DESC
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
        e.id,
        e.event_name as "eventName",
        e.short_description as "shortDescription",
        e.long_description as "longDescription",
        e.start_date as "startDate",
        e.end_date as "endDate",
        e.type,
        e.address,
        e.dates_and_times as "datesAndTimes",
        e.key_details as "keyDetails",
        e.images,
        e.tag_type as "tagType",
        e.tag_class_ids as "tagClassIds",
        e.tag_category_ids as "tagCategoryIds",
        e.tag_all_parents as "tagAllParents",
        e.tag_boosters as "tagBoosters",
        e.tag_volunteers as "tagVolunteers",
        e.scheduling_form_id as "schedulingFormId",
        sf.title as "schedulingFormTitle",
        e.archived,
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM events e
      LEFT JOIN scheduling_form sf ON sf.id = e.scheduling_form_id
      ORDER BY e.archived ASC, e.start_date ASC, e.created_at DESC
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
       tag_type, tag_class_ids, tag_category_ids, tag_all_parents, tag_boosters, tag_volunteers, scheduling_form_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        tag_volunteers as "tagVolunteers",
        scheduling_form_id as "schedulingFormId"
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
      value.schedulingFormId ?? null,
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
        images,
        scheduling_form_id
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
    if (formatValue(currentEvent.scheduling_form_id) !== formatValue(value.schedulingFormId ?? null)) {
      changes.schedulingFormId = { old: currentEvent.scheduling_form_id, new: value.schedulingFormId ?? null }
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
          scheduling_form_id = $17,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
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
        tag_volunteers as "tagVolunteers",
        scheduling_form_id as "schedulingFormId"
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
      value.schedulingFormId ?? null,
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

// ========== HIGHLIGHT ENDPOINTS ==========

// Public: published highlights for a site
app.get('/api/highlights', async (req, res) => {
  try {
    const site = typeof req.query.site === 'string' ? req.query.site.trim() : ''
    if (!site) {
      return res.status(400).json({ success: false, message: 'site query parameter is required' })
    }

    const result = await pool.query(
      `${HIGHLIGHT_SELECT}
       WHERE h.published = TRUE
         AND h.site_keys @> $1::jsonb
       ORDER BY h.sort_order ASC, h.updated_at DESC`,
      [JSON.stringify([site])],
    )

    const highlights = result.rows.map(mapHighlightRow)
    res.json({ success: true, highlights, data: highlights })
  } catch (error) {
    console.error('Get public highlights error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin: list all highlights
app.get('/api/admin/highlights', async (req, res) => {
  try {
    const result = await pool.query(
      `${HIGHLIGHT_SELECT}
       ORDER BY h.sort_order ASC, h.updated_at DESC`,
    )
    const highlights = result.rows.map(mapHighlightRow)
    res.json({ success: true, highlights, data: highlights })
  } catch (error) {
    console.error('Get admin highlights error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin: create highlight
app.post('/api/admin/highlights', async (req, res) => {
  try {
    const { error, value } = highlightSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }

    const contentError = await validateHighlightContent(value)
    if (contentError.error) {
      return res.status(400).json({ success: false, message: contentError.error })
    }
    const buttonError = validateHighlightButton(value)
    if (buttonError.error) {
      return res.status(400).json({ success: false, message: buttonError.error })
    }

    const buttonEnabled = value.buttonEnabled ?? false
    const buttonUrl = buttonEnabled ? (value.buttonUrl || '').trim() : null
    const buttonLabel = buttonEnabled
      ? ((value.buttonLabel || '').trim() || 'Learn more')
      : null
    const buttonTextAbove = (value.buttonTextAbove || '').trim() || null
    const buttonTextBelow = buttonEnabled
      ? ((value.buttonTextBelow || '').trim() || null)
      : null

    const result = await pool.query(
      `INSERT INTO highlights (
        title, content_type, event_id, document_mime, document_data, custom_content,
        site_keys, display_frequency, published, sort_order,
        button_enabled, button_label, button_url, button_text_above, button_text_below
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        value.title,
        value.contentType,
        value.contentType === 'event' ? value.eventId : null,
        value.contentType === 'document' ? value.documentMime : null,
        value.contentType === 'document' ? value.documentData : null,
        value.contentType === 'custom' ? JSON.stringify(value.customContent) : null,
        JSON.stringify(value.siteKeys),
        value.displayFrequency,
        value.published ?? false,
        value.sortOrder ?? 0,
        buttonEnabled,
        buttonLabel,
        buttonUrl,
        buttonTextAbove,
        buttonTextBelow,
      ],
    )

    const created = await pool.query(
      `${HIGHLIGHT_SELECT} WHERE h.id = $1`,
      [result.rows[0].id],
    )

    res.status(201).json({
      success: true,
      message: 'Highlight created successfully',
      data: mapHighlightRow(created.rows[0]),
    })
  } catch (error) {
    console.error('Create highlight error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin: reorder highlights
app.patch('/api/admin/highlights/reorder', async (req, res) => {
  try {
    const { error, value } = highlightReorderSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const item of value.items) {
        await client.query(
          'UPDATE highlights SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.sortOrder, item.id],
        )
      }
      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }

    res.json({ success: true, message: 'Highlights reordered successfully' })
  } catch (error) {
    console.error('Reorder highlights error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin: update highlight
app.put('/api/admin/highlights/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error, value } = highlightUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message })
    }

    const existing = await pool.query(
      'SELECT * FROM highlights WHERE id = $1',
      [id],
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Highlight not found' })
    }

    const merged = {
      title: value.title ?? existing.rows[0].title,
      contentType: value.contentType ?? existing.rows[0].content_type,
      eventId: value.eventId !== undefined ? value.eventId : existing.rows[0].event_id,
      documentMime: value.documentMime !== undefined ? value.documentMime : existing.rows[0].document_mime,
      documentData: value.documentData !== undefined ? value.documentData : existing.rows[0].document_data,
      customContent: value.customContent !== undefined
        ? value.customContent
        : (typeof existing.rows[0].custom_content === 'string'
          ? JSON.parse(existing.rows[0].custom_content)
          : existing.rows[0].custom_content),
      siteKeys: value.siteKeys ?? (
        typeof existing.rows[0].site_keys === 'string'
          ? JSON.parse(existing.rows[0].site_keys)
          : existing.rows[0].site_keys
      ),
      displayFrequency: value.displayFrequency ?? existing.rows[0].display_frequency,
      published: value.published !== undefined ? value.published : existing.rows[0].published,
      sortOrder: value.sortOrder !== undefined ? value.sortOrder : existing.rows[0].sort_order,
      buttonEnabled: value.buttonEnabled !== undefined
        ? value.buttonEnabled
        : existing.rows[0].button_enabled,
      buttonLabel: value.buttonLabel !== undefined
        ? value.buttonLabel
        : existing.rows[0].button_label,
      buttonUrl: value.buttonUrl !== undefined
        ? value.buttonUrl
        : existing.rows[0].button_url,
      buttonTextAbove: value.buttonTextAbove !== undefined
        ? value.buttonTextAbove
        : existing.rows[0].button_text_above,
      buttonTextBelow: value.buttonTextBelow !== undefined
        ? value.buttonTextBelow
        : existing.rows[0].button_text_below,
    }

    const contentError = await validateHighlightContent(merged)
    if (contentError.error) {
      return res.status(400).json({ success: false, message: contentError.error })
    }
    const buttonError = validateHighlightButton(merged)
    if (buttonError.error) {
      return res.status(400).json({ success: false, message: buttonError.error })
    }

    const buttonEnabled = merged.buttonEnabled ?? false
    const buttonUrl = buttonEnabled ? (merged.buttonUrl || '').trim() : null
    const buttonLabel = buttonEnabled
      ? ((merged.buttonLabel || '').trim() || 'Learn more')
      : null
    const buttonTextAbove = (merged.buttonTextAbove || '').trim() || null
    const buttonTextBelow = buttonEnabled
      ? ((merged.buttonTextBelow || '').trim() || null)
      : null

    await pool.query(
      `UPDATE highlights SET
        title = $1,
        content_type = $2,
        event_id = $3,
        document_mime = $4,
        document_data = $5,
        custom_content = $6,
        site_keys = $7,
        display_frequency = $8,
        published = $9,
        sort_order = $10,
        button_enabled = $11,
        button_label = $12,
        button_url = $13,
        button_text_above = $14,
        button_text_below = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16`,
      [
        merged.title,
        merged.contentType,
        merged.contentType === 'event' ? merged.eventId : null,
        merged.contentType === 'document' ? merged.documentMime : null,
        merged.contentType === 'document' ? merged.documentData : null,
        merged.contentType === 'custom' ? JSON.stringify(merged.customContent) : null,
        JSON.stringify(merged.siteKeys),
        merged.displayFrequency,
        merged.published,
        merged.sortOrder,
        buttonEnabled,
        buttonLabel,
        buttonUrl,
        buttonTextAbove,
        buttonTextBelow,
        id,
      ],
    )

    const updated = await pool.query(
      `${HIGHLIGHT_SELECT} WHERE h.id = $1`,
      [id],
    )

    res.json({
      success: true,
      message: 'Highlight updated successfully',
      data: mapHighlightRow(updated.rows[0]),
    })
  } catch (error) {
    console.error('Update highlight error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin: delete highlight
app.delete('/api/admin/highlights/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'DELETE FROM highlights WHERE id = $1 RETURNING id',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Highlight not found' })
    }

    res.json({ success: true, message: 'Highlight deleted successfully' })
  } catch (error) {
    console.error('Delete highlight error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Admin endpoint to create member_program table if it doesn't exist
app.post('/api/admin/create-member-program-table', authenticateAdmin, async (req, res) => {
  try {
    console.log('[Create member_program table] Request received')
    
    // Check if table already exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member_program'
      )
    `)
    
    if (tableCheck.rows[0].exists) {
      return res.json({
        success: true,
        message: 'member_program table already exists',
        tableExists: true
      })
    }
    
    // Create member_program table
    await pool.query(`
      CREATE TABLE member_program (
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
    console.log('[Create member_program table] Table created')
    
    // Create indexes
    await pool.query(`CREATE INDEX idx_member_program_member ON member_program(member_id)`)
    await pool.query(`CREATE INDEX idx_member_program_program ON member_program(program_id)`)
    await pool.query(`CREATE INDEX idx_member_program_iteration ON member_program(iteration_id)`)
    console.log('[Create member_program table] Indexes created')
    
    res.json({
      success: true,
      message: 'member_program table and indexes created successfully',
      tableExists: false,
      created: true
    })
  } catch (error) {
    console.error('[Create member_program table] Error:', error)
    res.status(500).json({
      success: false,
      message: 'Error creating member_program table: ' + error.message,
      error: process.env.NODE_ENV !== 'production' ? error.stack : undefined
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
// Updated to use app_user table with MASTER_ADMIN / ADMIN roles (modern RBAC system)
// Falls back to admins table for backward compatibility during migration
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
    
    let admin = null
    let userSource = null // Track which table we found the user in
    
    // First, try app_user table (preferred - modern RBAC system)
    try {
      let query, params
      if (isEmail) {
        // Check app_user for an admin-capable role
        query = `
          SELECT 
            au.id, 
            au.email, 
            au.full_name,
            au.password_hash,
            au.phone,
            au.role,
            au.is_active,
            au.username,
            (
              au.role::text IN ('MASTER_ADMIN', 'ADMIN')
              OR COALESCE(ap.is_master_admin, false)
              OR EXISTS(
                SELECT 1 FROM app_user_role ur 
                WHERE ur.user_id = au.id 
                AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
              )
            ) as has_admin_role,
            COALESCE(ap.is_master_admin, false) as is_master_admin
          FROM app_user au
          LEFT JOIN admin_profile ap ON ap.user_id = au.id
          WHERE au.email = $1
          AND (
            au.role::text IN ('MASTER_ADMIN', 'ADMIN')
            OR COALESCE(ap.is_master_admin, false)
            OR EXISTS(
              SELECT 1 FROM app_user_role ur 
              WHERE ur.user_id = au.id 
              AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
            )
          )
        `
        params = [usernameOrEmail]
      } else {
        query = `
          SELECT 
            au.id, 
            au.email, 
            au.full_name,
            au.password_hash,
            au.phone,
            au.role,
            au.is_active,
            au.username,
            (
              au.role::text IN ('MASTER_ADMIN', 'ADMIN')
              OR COALESCE(ap.is_master_admin, false)
              OR EXISTS(
                SELECT 1 FROM app_user_role ur 
                WHERE ur.user_id = au.id 
                AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
              )
            ) as has_admin_role,
            COALESCE(ap.is_master_admin, false) as is_master_admin
          FROM app_user au
          LEFT JOIN admin_profile ap ON ap.user_id = au.id
          WHERE LOWER(au.username) = LOWER($1)
          AND (
            au.role::text IN ('MASTER_ADMIN', 'ADMIN')
            OR COALESCE(ap.is_master_admin, false)
            OR EXISTS(
              SELECT 1 FROM app_user_role ur 
              WHERE ur.user_id = au.id 
              AND ur.role::text IN ('MASTER_ADMIN', 'ADMIN')
            )
          )
        `
        params = [usernameOrEmail]
      }
      
      const appUserResult = await pool.query(query, params)
      
      if (appUserResult.rows.length > 0) {
        const user = appUserResult.rows[0]
        
        // Verify user has an admin-capable role
        const isAdminUser = user.has_admin_role === true
        
        if (isAdminUser && user.is_active) {
          admin = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            password_hash: user.password_hash,
            phone: user.phone,
            username: user.username,
            is_active: user.is_active,
            is_master: user.is_master_admin === true || user.role === 'MASTER_ADMIN',
            first_name: user.full_name?.split(' ')[0] || 'Admin',
            last_name: user.full_name?.split(' ').slice(1).join(' ') || 'User'
          }
          userSource = 'app_user'
          console.log('[Admin Login] Found admin in app_user table:', admin.email)
        }
      }
    } catch (appUserError) {
      console.error('[Admin Login] Error checking app_user table:', appUserError.message)
      // Continue to fallback
    }
    
    // Fallback: Check legacy admins table (for backward compatibility)
    if (!admin) {
      try {
        let query, params
        if (isEmail) {
          query = 'SELECT * FROM admins WHERE email = $1'
          params = [usernameOrEmail]
        } else {
          query = 'SELECT * FROM admins WHERE LOWER(username) = LOWER($1)'
          params = [usernameOrEmail]
        }
        
        const adminsResult = await pool.query(query, params)
        
        if (adminsResult.rows.length > 0) {
          admin = adminsResult.rows[0]
          userSource = 'admins'
          console.log('[Admin Login] Found admin in legacy admins table:', admin.email)
          console.warn('[Admin Login] WARNING: Using legacy admins table. Consider migrating to app_user table.')
        }
      } catch (adminsError) {
        console.error('[Admin Login] Error checking admins table:', adminsError.message)
      }
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      })
    }

    // Verify account is active
    if (userSource === 'app_user' && !admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      })
    }

    // Verify password
    if (!admin.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      })
    }

    const isValid = await bcrypt.compare(value.password, admin.password_hash)
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      })
    }

    const adminRolesForLogin = userSource === 'app_user'
      ? await getUserRoles(admin.id)
      : ['MASTER_ADMIN']
    const adminFamilyContext = userSource === 'app_user'
      ? await getUserFamilyContext(admin.id).catch(() => null)
      : null
    const adminPortalRoles = ['MASTER_ADMIN', 'ADMIN']
    const memberPortalRoles = ['MEMBER_ATHLETE']
    const isAdminPortalUser = adminRolesForLogin.some((role) => adminPortalRoles.includes(role))
    const isCoachPortalUser = adminRolesForLogin.includes('COACH')
    const hasMemberPortal = adminRolesForLogin.some((role) => memberPortalRoles.includes(role)) || Boolean(adminFamilyContext)
    const availablePortals = [
      ...(hasMemberPortal ? ['member'] : []),
      ...(isCoachPortalUser ? ['coach'] : []),
      ...(isAdminPortalUser ? ['admin'] : []),
    ]

    // Create JWT token for admin
    console.log('[Admin Login] Starting token creation for admin:', admin.id, admin.email)
    console.log('[Admin Login] User source:', userSource)
    console.log('[Admin Login] JWT_SECRET exists?', !!JWT_SECRET, 'Length:', JWT_SECRET?.length)
    
    try {
      // Create token with consistent format for both app_user and admins
      const adminToken = jwt.sign(
        { 
          adminId: admin.id,
          userId: admin.id, // Include for compatibility
          role: admin.role || 'MASTER_ADMIN',
          roles: adminRolesForLogin,
          email: admin.email 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      console.log('[Admin Login] Token created successfully for admin:', admin.id, admin.email)
      console.log('[Admin Login] Token length:', adminToken.length)

      // Return admin info (without password) and token
      const responseData = {
        success: true,
        admin: {
          id: admin.id,
          firstName: admin.first_name || admin.full_name?.split(' ')[0] || 'Admin',
          lastName: admin.last_name || admin.full_name?.split(' ').slice(1).join(' ') || 'User',
          email: admin.email,
          phone: admin.phone || null,
          username: admin.username || null,
          role: admin.role || 'MASTER_ADMIN',
          roles: adminRolesForLogin,
          isMaster: admin.is_master || adminRolesForLogin.some((role) => role === 'MASTER_ADMIN'),
          isCoach: isCoachPortalUser,
          hasMemberPortal,
          memberId: adminFamilyContext?.current_member_id ?? null,
          familyId: adminFamilyContext?.id ?? null,
          familyName: adminFamilyContext?.family_name ?? null,
          availablePortals,
        },
        token: adminToken,
        userSource: userSource // Include for debugging (can be removed in production)
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

app.post('/api/admin/request-password-reset', async (req, res) => {
  try {
    const { error, value } = memberPasswordResetRequestSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation error' })
    }
    const normalizedEmail = value.email.trim().toLowerCase()
    const userResult = await pool.query(`
      SELECT au.id, au.email, au.full_name
      FROM app_user au
      LEFT JOIN app_user_role aur ON aur.user_id = au.id
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      WHERE LOWER(au.email) = $1
        AND au.is_active = TRUE
        AND (
          au.role::text IN ('MASTER_ADMIN', 'ADMIN')
          OR aur.role::text IN ('MASTER_ADMIN', 'ADMIN')
          OR COALESCE(ap.is_master_admin, false)
        )
      LIMIT 1
    `, [normalizedEmail])

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0]
      const temporaryPassword = generateTemporaryPassword(12)
      const passwordHash = await bcrypt.hash(temporaryPassword, 10)
      await pool.query(
        `UPDATE app_user SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id, passwordHash],
      )
      await sendTemporaryPasswordEmail({
        registrantFirstName: String(user.full_name || '').split(' ')[0] || 'there',
        registrantEmail: user.email,
        temporaryPassword,
      })
    }

    res.json({
      success: true,
      message: 'If an admin account exists for that email, a temporary password has been sent.',
    })
  } catch (error) {
    console.error('Admin password reset request error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Get all admins from unified app_user/admin_profile model.
app.get('/api/admin/admins', requireAdminPermission('admins.manage'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        au.id,
        split_part(au.full_name, ' ', 1) as first_name,
        CASE
          WHEN position(' ' in au.full_name) > 0 THEN substr(au.full_name, position(' ' in au.full_name) + 1)
          ELSE ''
        END as last_name,
        au.full_name,
        au.email,
        au.phone,
        au.username,
        au.role::text as role,
        au.is_active,
        COALESCE(ap.is_master_admin, false) as is_master_admin,
        COALESCE(array_agg(DISTINCT aur.role::text) FILTER (WHERE aur.role IS NOT NULL), '{}') as roles,
        au.created_at,
        au.updated_at
      FROM app_user au
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      LEFT JOIN app_user_role aur ON aur.user_id = au.id
      WHERE au.role::text IN ('MASTER_ADMIN', 'ADMIN')
         OR EXISTS (
          SELECT 1 FROM app_user_role role_check
          WHERE role_check.user_id = au.id
            AND role_check.role::text IN ('MASTER_ADMIN', 'ADMIN')
         )
      GROUP BY au.id, ap.is_master_admin
      ORDER BY au.created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows.map(mapAdminAccountRow)
    })
  } catch (error) {
    console.error('Get admins error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Get current admin info from the authenticated token.
app.get('/api/admin/admins/me', async (req, res) => {
  try {
    const adminId = req.adminId
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID required'
      })
    }

    const result = await pool.query(`
      SELECT
        au.id,
        split_part(au.full_name, ' ', 1) as first_name,
        CASE
          WHEN position(' ' in au.full_name) > 0 THEN substr(au.full_name, position(' ' in au.full_name) + 1)
          ELSE ''
        END as last_name,
        au.full_name,
        au.email,
        au.phone,
        au.username,
        au.role::text as role,
        au.is_active,
        COALESCE(ap.is_master_admin, false) as is_master_admin,
        COALESCE(array_agg(DISTINCT aur.role::text) FILTER (WHERE aur.role IS NOT NULL), '{}') as roles,
        au.created_at,
        au.updated_at
      FROM app_user au
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      LEFT JOIN app_user_role aur ON aur.user_id = au.id
      WHERE au.id = $1
      GROUP BY au.id, ap.is_master_admin
    `, [adminId])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    res.json({
      success: true,
      data: mapAdminAccountRow(result.rows[0])
    })
  } catch (error) {
    console.error('Get admin error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// Create new admin in app_user/admin_profile.
app.post('/api/admin/admins', requireAdminPermission('admins.manage'), async (req, res) => {
  try {
    const { error, value } = adminSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const facilityResult = await pool.query('SELECT id FROM facility ORDER BY id LIMIT 1')
    const facilityId = facilityResult.rows[0]?.id
    if (!facilityId) return res.status(500).json({ success: false, message: 'No facility found' })

    // Check if username or email already exists (username case-insensitive)
    const existing = await pool.query(
      'SELECT id FROM app_user WHERE facility_id = $1 AND (LOWER(username) = LOWER($2) OR email = $3)',
      [facilityId, value.username, value.email]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 10)

    const fullName = `${value.firstName} ${value.lastName}`.trim()
    const result = await pool.query(`
      INSERT INTO app_user (facility_id, role, email, phone, full_name, username, password_hash, is_active)
      VALUES ($1, 'ADMIN'::user_role, $2, $3, $4, $5, $6, TRUE)
      RETURNING *
    `, [
      facilityId,
      value.email,
      value.phone || null,
      fullName,
      value.username,
      passwordHash
    ])

    const userId = result.rows[0].id
    await setUserRoles(userId, ['ADMIN'])
    await syncRoleProfiles(userId, ['ADMIN'])
    await ensureMemberForAppUser(userId)

    res.json({
      success: true,
      data: mapAdminAccountRow({
        ...result.rows[0],
        first_name: value.firstName,
        last_name: value.lastName,
        is_master_admin: false,
        roles: ['ADMIN'],
      })
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
    await ensureProgramCategoriesSchema()
    const { ensureProgramsSchedulingSchema, ensureDisciplineTagsSchema, ensurePrimaryDisciplineTagColumn, ensureProgramPricingColumns } = await import('./programs/schema.js')
    const { mapClassPricingFields } = await import('./programs/pricingDefaults.js')
    await ensureProgramsSchedulingSchema(pool)
    await ensureDisciplineTagsSchema(pool)
    await ensurePrimaryDisciplineTagColumn(pool)
    await ensureProgramPricingColumns(pool)
    const taxonomy = await resolveProgramTaxonomy()
    const { archived, includePricing } = req.query
    const programIsActiveSelect = taxonomy.hasProgramIsActive
      ? `COALESCE(pc.is_active, TRUE) as "programIsActive",`
      : `TRUE as "programIsActive",`
    let query = `
      SELECT 
        p.id,
        p.category,
        p.${taxonomy.programFkColumn} as "categoryId",
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
        ${programIsActiveSelect}
        p.archived,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        primary_dt.name AS "primarySport",
        COALESCE((
          SELECT string_agg(dt.name, ', ' ORDER BY dt.sort_order, dt.name)
          FROM program_discipline_tag pdt
          JOIN discipline_tag dt ON dt.id = pdt.tag_id
          WHERE pdt.programs_id = p.${taxonomy.programFkColumn}
            AND dt.id IS DISTINCT FROM pc.primary_discipline_tag_id
        ), '') as "sportTags",
        COALESCE((
          SELECT COUNT(*)::int FROM scheduling_offering o
          INNER JOIN scheduling_form sf ON sf.id = o.form_id AND sf.deleted_at IS NULL
          WHERE sf.program_id = p.id
        ), 0) as "offeringCount",
        COALESCE((
          SELECT COUNT(*)::int FROM scheduling_slot_group g
          INNER JOIN scheduling_form sf ON sf.id = g.form_id AND sf.deleted_at IS NULL
          WHERE sf.program_id = p.id
        ), 0) as "slotCount"
        ${includePricing === 'true' ? `,
        sf.id as "schedulingFormId",
        sf.pricing_overrides_program as "pricingOverridesProgram",
        sf.max_slots_per_user as "formMaxSlotsPerUser",
        sf.slot_cost_monthly_cents as "formSlotCostMonthlyCents",
        sf.free_slots_per_user as "formFreeSlotsPerUser",
        sf.max_free_slots_total as "formMaxFreeSlotsTotal",
        pc.pricing_max_slots_per_user as "programMaxSlotsPerUser",
        pc.pricing_slot_cost_monthly_cents as "programSlotCostMonthlyCents",
        pc.pricing_free_slots_per_user as "programFreeSlotsPerUser",
        pc.pricing_max_free_slots_total as "programMaxFreeSlotsTotal"` : ''}
      FROM program p
      LEFT JOIN ${taxonomy.programsTable} pc ON p.${taxonomy.programFkColumn} = pc.id
      LEFT JOIN discipline_tag primary_dt ON primary_dt.id = pc.primary_discipline_tag_id
      ${includePricing === 'true' ? `LEFT JOIN scheduling_form sf ON sf.program_id = p.id AND sf.deleted_at IS NULL` : ''}
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

    const rows = result.rows.map((row) => {
      let pricingFields = {}
      if (includePricing === 'true' && row.schedulingFormId != null) {
        pricingFields = mapClassPricingFields(
          {
            pricing_max_slots_per_user: row.programMaxSlotsPerUser,
            pricing_slot_cost_monthly_cents: row.programSlotCostMonthlyCents,
            pricing_free_slots_per_user: row.programFreeSlotsPerUser,
            pricing_max_free_slots_total: row.programMaxFreeSlotsTotal,
          },
          {
            id: row.schedulingFormId,
            pricing_overrides_program: row.pricingOverridesProgram,
            max_slots_per_user: row.formMaxSlotsPerUser,
            slot_cost_monthly_cents: row.formSlotCostMonthlyCents,
            free_slots_per_user: row.formFreeSlotsPerUser,
            max_free_slots_total: row.formMaxFreeSlotsTotal,
          },
        )
      }
      return { ...row, ...pricingFields }
    })

    res.json({
      success: true,
      programs: rows,
      data: rows
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

    // Link scheduling form for slots/signups (replaces default iteration for new class/events)
    try {
      const { ensureProgramsSchedulingSchema, resolveProgramsSchema } = await import('./programs/schema.js')
      await ensureProgramsSchedulingSchema(pool)
      const progSchema = await resolveProgramsSchema(pool)
      if (progSchema.hasSchedulingProgramLink) {
        const programsId = categoryId || null
        const existing = await pool.query(
          `SELECT id FROM scheduling_form WHERE program_id = $1 AND deleted_at IS NULL LIMIT 1`,
          [newProgramId],
        )
        if (existing.rows.length === 0) {
          const cols = ['title', 'description', 'is_active']
          const vals = [value.displayName, value.description || null, value.isActive !== false]
          if (progSchema.hasSchedulingProgramsLink && programsId) {
            cols.push('programs_id', 'program_id')
            vals.push(programsId, newProgramId)
          } else {
            cols.push('program_id')
            vals.push(newProgramId)
          }
          const ph = vals.map((_, i) => `$${i + 1}`).join(', ')
          await pool.query(`INSERT INTO scheduling_form (${cols.join(', ')}) VALUES (${ph})`)
        }
      }
    } catch (schedErr) {
      console.error('Error creating scheduling form for class/event:', schedErr)
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
    const { error, value } = programUpdateSchema.validate(req.body, {
      stripUnknown: true,
      convert: true,
    })
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

    // Check program FK column (programs_id after unify migration, or legacy category_id)
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'program' 
      AND column_name IN ('category_id', 'programs_id')
    `)
    const programCols = new Set(columnCheck.rows.map((row) => row.column_name))
    const { resolveProgramsSchema } = await import('./programs/schema.js')
    const schema = await resolveProgramsSchema(pool)
    const fkCol = schema.programFkColumn
    const parentProgramId =
      value.programsId !== undefined ? value.programsId : value.categoryId

    // Handle parent program FK update when provided
    if (programCols.has(fkCol) && parentProgramId !== undefined) {
      updates.push(`${fkCol} = $${paramCount++}`)
      values.push(parentProgramId)
      
      // If parent program is being set, update the legacy category enum to match
      if (parentProgramId !== null) {
        const categoryResult = await pool.query(
          `SELECT name FROM ${schema.programsTable} WHERE id = $1 AND archived = FALSE LIMIT 1`,
          [parentProgramId]
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
      }
    }

    const hasCategoryIdColumn = programCols.has('category_id')

    if (value.displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(value.displayName)
      // Keep the linked scheduling form's title in sync with the class name so
      // the public /scheduling page never shows a stale title.
      try {
        await pool.query(
          `UPDATE scheduling_form SET title = $1, updated_at = CURRENT_TIMESTAMP
           WHERE program_id = $2 AND deleted_at IS NULL`,
          [value.displayName, id],
        )
      } catch {
        /* scheduling_form optional */
      }
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
      if (value.isActive === true) {
        const taxonomy = await resolveProgramTaxonomy()
        if (taxonomy.hasProgramIsActive) {
          const fkCol = taxonomy.programFkColumn
          const classRow = await pool.query(
            `SELECT ${fkCol} as parent_id FROM program WHERE id = $1`,
            [id],
          )
          const parentId = classRow.rows[0]?.parent_id
          if (parentId) {
            const parent = await pool.query(
              `SELECT is_active FROM ${taxonomy.programsTable} WHERE id = $1`,
              [parentId],
            )
            if (parent.rows[0]?.is_active === false) {
              return res.status(400).json({
                success: false,
                message: 'Cannot activate a class while its program is inactive',
              })
            }
          }
        }
      }
      updates.push(`is_active = $${paramCount++}`)
      values.push(value.isActive)
      try {
        await pool.query(
          `UPDATE scheduling_form SET is_active = $1, updated_at = CURRENT_TIMESTAMP
           WHERE program_id = $2 AND deleted_at IS NULL`,
          [value.isActive, id],
        )
      } catch {
        /* scheduling_form optional */
      }
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
    const fkReturning = programCols.has('programs_id')
      ? 'programs_id as "programsId", programs_id as "categoryId",'
      : hasCategoryIdColumn
        ? 'category_id as "categoryId",'
        : 'NULL as "categoryId",'
    let returningClause = `
      id,
      category,
      ${fkReturning}
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

    // Fetch parent program display name when linked
    if (result.rows.length > 0) {
      const parentId = result.rows[0].programsId ?? result.rows[0].categoryId
      if (parentId) {
        const categoryInfo = await pool.query(
          `SELECT name, display_name FROM ${schema.programsTable} WHERE id = $1`,
          [parentId],
        )
        if (categoryInfo.rows.length > 0) {
          result.rows[0].categoryName = categoryInfo.rows[0].name
          result.rows[0].categoryDisplayName = categoryInfo.rows[0].display_name
        }
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
    
    let result
    try {
      result = await pool.query(`
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
    } catch (queryError) {
      // If column doesn't exist, try to add it and retry
      if (queryError.code === '42703' && queryError.message.includes('time_blocks')) {
        console.log('time_blocks column missing, adding it now...')
        try {
          await pool.query(`
            ALTER TABLE class_iteration ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT NULL
          `)
          console.log('✅ Added time_blocks column, retrying query...')
          // Retry the query
          result = await pool.query(`
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
        } catch (alterError) {
          // If adding column fails, return data without time_blocks
          console.warn('Could not add time_blocks column, returning data without it:', alterError.message)
          result = await pool.query(`
            SELECT 
              id,
              program_id as "programId",
              iteration_number as "iterationNumber",
              days_of_week as "daysOfWeek",
              start_time as "startTime",
              end_time as "endTime",
              NULL as "timeBlocks",
              duration_type as "durationType",
              start_date as "startDate",
              end_date as "endDate",
              created_at as "createdAt",
              updated_at as "updatedAt"
            FROM class_iteration
            WHERE program_id = $1
            ORDER BY iteration_number ASC
          `, [programId])
        }
      } else {
        throw queryError
      }
    }

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

/** Ensures program_categories, skill_levels, and program.category_id/archived exist (local DB bootstrap). */
let programTaxonomyCache = null
async function resolveProgramTaxonomy() {
  if (programTaxonomyCache) return programTaxonomyCache
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('programs', 'program_categories')
  `)
  const hasPrograms = tableCheck.rows.some((r) => r.table_name === 'programs')
  const programsTable = hasPrograms ? 'programs' : 'program_categories'
  const colCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'program' AND column_name IN ('programs_id', 'category_id')
  `)
  const programFkColumn = colCheck.rows.some((r) => r.column_name === 'programs_id')
    ? 'programs_id'
    : 'category_id'
  const activeColCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'is_active' LIMIT 1`,
    [programsTable],
  )
  programTaxonomyCache = {
    programsTable,
    programFkColumn,
    hasProgramIsActive: activeColCheck.rows.length > 0,
  }
  return programTaxonomyCache
}

async function deactivateClassesForProgram(programsId, taxonomy) {
  const { programsTable, programFkColumn } = taxonomy
  await pool.query(
    `UPDATE program SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE ${programFkColumn} = $1 AND archived = FALSE`,
    [programsId],
  )
  try {
    await pool.query(
      `UPDATE scheduling_form sf SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       FROM program p
       WHERE sf.program_id = p.id AND p.${programFkColumn} = $1`,
      [programsId],
    )
  } catch {
    /* scheduling_form optional */
  }
  try {
    await pool.query(
      `UPDATE scheduling_form SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE programs_id = $1 AND deleted_at IS NULL`,
      [programsId],
    )
  } catch {
    /* programs_id on scheduling_form optional */
  }
  try {
    await pool.query(
      `UPDATE ${programsTable} SET scheduling_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [programsId],
    )
  } catch {
    /* scheduling_active optional */
  }
}

const ensureProgramCategoriesSchema = async () => {
  const migrationFiles = [
    'add_categories_levels_tables.sql',
    'add_category_description.sql',
    'add_programs_is_active.sql',
  ]

  for (const file of migrationFiles) {
    const migrationPath = path.join(__dirname, 'migrations', file)
    if (!fs.existsSync(migrationPath)) {
      console.warn(`[ensureProgramCategoriesSchema] Missing migration file: ${file}`)
      continue
    }

    try {
      await pool.query(fs.readFileSync(migrationPath, 'utf8'))
    } catch (err) {
      // Idempotent migrations may warn on duplicates; rethrow missing-relation errors
      if (err.code === '42P01') {
        console.error(`[ensureProgramCategoriesSchema] ${file} failed:`, err.message)
        throw err
      }
      console.warn(`[ensureProgramCategoriesSchema] ${file}:`, err.message)
    }
  }

    console.log('✅ Program categories schema ensured')
  programTaxonomyCache = null
  try {
    const { ensureProgramsSchedulingSchema } = await import('./programs/schema.js')
    await ensureProgramsSchedulingSchema(pool)
  } catch (err) {
    console.warn('[ensureProgramCategoriesSchema] unify programs:', err.message)
  }
}

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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_program ON class_iteration(program_id)`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_class_iteration_number ON class_iteration(program_id, iteration_number)`)
      console.log('✅ class_iteration table created successfully')
    } else {
      console.log('✅ class_iteration table already exists')
    }
    
    // Always ensure time_blocks column exists (even if table was created before this column was added)
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'class_iteration' AND column_name = 'time_blocks'
          ) THEN
            ALTER TABLE class_iteration ADD COLUMN time_blocks JSONB DEFAULT NULL;
          RAISE NOTICE 'Added time_blocks column to class_iteration table';
          END IF;
        END $$;
      `)
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
    // For JSONB columns, stringify and cast in SQL to avoid encoding issues
    let timeBlocksValue = null
    if (timeBlocks && Array.isArray(timeBlocks) && timeBlocks.length > 0) {
      timeBlocksValue = timeBlocks
    }
    
    // For JSONB columns, pass raw object/array - pg library handles conversion automatically
    let result
    try {
      result = await pool.query(`
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
      timeBlocksValue, // Pass raw object/array, pg library handles JSONB conversion
      defaultDurationType,
      defaultDurationType === 'indefinite' ? null : startDate,
      defaultDurationType === 'finite' ? endDate : null
    ])
    } catch (insertError) {
      // If column doesn't exist, try to add it and retry
      if (insertError.code === '42703' && insertError.message.includes('time_blocks')) {
        console.log('time_blocks column missing in INSERT, adding it now...')
        try {
          await pool.query(`
            ALTER TABLE class_iteration ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT NULL
          `)
          console.log('✅ Added time_blocks column, retrying INSERT...')
          // Retry the INSERT with proper JSONB casting
          result = await pool.query(`
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
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
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
            timeBlocksParam,
            defaultDurationType,
            defaultDurationType === 'indefinite' ? null : startDate,
            defaultDurationType === 'finite' ? endDate : null
          ])
        } catch (retryError) {
          throw retryError
        }
      } else {
        throw insertError
      }
    }

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
  const { programId, iterationId } = req.params
  
  try {
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

    // Validate and normalize daysOfWeek
    let normalizedDaysOfWeek = daysOfWeek
    if (!daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'daysOfWeek must be a non-empty array'
      })
    }

    // Convert to integers and validate each day is between 1-7
    try {
      normalizedDaysOfWeek = daysOfWeek.map(day => {
        const numDay = typeof day === 'string' ? parseInt(day, 10) : day
        if (!Number.isInteger(numDay) || numDay < 1 || numDay > 7) {
          throw new Error(`Invalid day value: ${day}`)
        }
        return numDay
      })
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: 'daysOfWeek must contain integers between 1 and 7 (1=Monday, 7=Sunday)'
      })
    }

    if (!startTime || typeof startTime !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'startTime is required and must be a string'
      })
    }

    if (!endTime || typeof endTime !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'endTime is required and must be a string'
      })
    }

    if (!durationType || !['indefinite', '3_month_block', 'finite'].includes(durationType)) {
      return res.status(400).json({
        success: false,
        message: 'durationType must be one of: indefinite, 3_month_block, finite'
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
    if (timeBlocks) {
      // If timeBlocks is a string, try to parse it
      let parsedTimeBlocks = timeBlocks
      if (typeof timeBlocks === 'string') {
        try {
          parsedTimeBlocks = JSON.parse(timeBlocks)
        } catch (parseError) {
          console.error('Failed to parse timeBlocks as JSON:', parseError)
          return res.status(400).json({
            success: false,
            message: 'timeBlocks must be a valid JSON array'
          })
        }
      }

      // Validate it's an array
      if (!Array.isArray(parsedTimeBlocks)) {
        return res.status(400).json({
          success: false,
          message: 'timeBlocks must be an array'
        })
      }

      // Validate and clean each time block
      if (parsedTimeBlocks.length > 0) {
        try {
          const cleanedTimeBlocks = parsedTimeBlocks.map(tb => {
            if (!tb || typeof tb !== 'object') {
              throw new Error('Each time block must be an object')
            }
            if (!Array.isArray(tb.daysOfWeek) || tb.daysOfWeek.length === 0) {
              throw new Error('Each time block must have a non-empty daysOfWeek array')
            }
            if (!tb.startTime || typeof tb.startTime !== 'string') {
              throw new Error('Each time block must have a valid startTime string')
            }
            if (!tb.endTime || typeof tb.endTime !== 'string') {
              throw new Error('Each time block must have a valid endTime string')
            }
            return {
              daysOfWeek: tb.daysOfWeek,
              startTime: tb.startTime,
              endTime: tb.endTime
            }
          })
          // Ensure it's a proper JavaScript array/object, not a string
          timeBlocksValue = cleanedTimeBlocks
        } catch (validationError) {
          return res.status(400).json({
            success: false,
            message: validationError.message || 'Invalid timeBlocks format'
          })
        }
      }
    }

    // Log the request for debugging
    console.log('Request body received:', JSON.stringify(req.body, null, 2))
    console.log('Request params:', { programId, iterationId })
    console.log('timeBlocksValue type:', typeof timeBlocksValue, 'value:', JSON.stringify(timeBlocksValue))
    
    let result
    try {
      // For JSONB columns, the pg library handles conversion automatically
      // Pass the raw object/array and let pg convert it to JSONB
      let finalTimeBlocksValue = timeBlocksValue
      if (timeBlocksValue && typeof timeBlocksValue === 'string') {
        try {
          finalTimeBlocksValue = JSON.parse(timeBlocksValue)
        } catch (parseErr) {
          console.error('timeBlocksValue was a string but failed to parse:', parseErr)
          finalTimeBlocksValue = null
        }
      }
      
      result = await pool.query(`
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
      normalizedDaysOfWeek,
      startTime,
      endTime,
      finalTimeBlocksValue, // Pass raw object/array, pg library handles JSONB conversion
      durationType,
      durationType === 'indefinite' ? null : startDate,
      durationType === 'finite' ? endDate : null,
      iterationId,
      programId
    ])
    } catch (updateError) {
      console.error('Update iteration error:', updateError)
      // If column doesn't exist, try to add it and retry
      if (updateError.code === '42703' && updateError.message.includes('time_blocks')) {
        console.log('time_blocks column missing in UPDATE, adding it now...')
        try {
          await pool.query(`
            ALTER TABLE class_iteration ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT NULL
          `)
          console.log('✅ Added time_blocks column, retrying UPDATE...')
          // Ensure timeBlocksValue is properly formatted for retry
          let retryTimeBlocksValue = timeBlocksValue
          if (timeBlocksValue && typeof timeBlocksValue === 'string') {
            try {
              retryTimeBlocksValue = JSON.parse(timeBlocksValue)
            } catch (parseErr) {
              console.error('timeBlocksValue was a string but failed to parse in retry:', parseErr)
              retryTimeBlocksValue = null
            }
          }
          
          // Retry the UPDATE
          result = await pool.query(`
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
            normalizedDaysOfWeek,
            startTime,
            endTime,
            retryTimeBlocksValue, // Pass raw object/array, pg library handles JSONB conversion
            durationType,
            durationType === 'indefinite' ? null : startDate,
            durationType === 'finite' ? endDate : null,
            iterationId,
            programId
          ])
        } catch (retryError) {
          throw retryError
        }
      } else {
        throw updateError
      }
    }

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
    console.error('Request body received:', JSON.stringify(req.body, null, 2))
    console.error('Request params:', { programId, iterationId })
    
    // Provide more specific error messages for common issues
    let errorMessage = 'Internal server error'
    if (error.code === '22P02') {
      errorMessage = 'Invalid data format - check that all fields are correctly formatted'
    } else if (error.code === '23502') {
      errorMessage = 'Required field is missing'
    } else if (error.code === '23514') {
      errorMessage = 'Data validation failed - check field constraints'
    } else if (error.message) {
      errorMessage = error.message
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        where: error.where
      } : undefined
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

// Get iterations with enrollment stats (enrollment counts per day)
app.get('/api/admin/programs/:programId/iterations/stats', async (req, res) => {
  try {
    const { programId } = req.params
    
    // Ensure table exists (create if missing)
    try {
      await ensureClassIterationTable()
    } catch (error) {
      console.warn('Could not ensure class_iteration table exists:', error.message)
      return res.json({
        success: true,
        data: [],
        warning: 'class_iteration table not available'
      })
    }
    
    // Get all iterations for the program
    let iterationsResult
    try {
      iterationsResult = await pool.query(`
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
    } catch (queryError) {
      if (queryError.message && (queryError.message.includes('does not exist') || queryError.message.includes('relation') && queryError.message.includes('class_iteration'))) {
        return res.json({
          success: true,
          data: [],
          warning: 'class_iteration table not found'
        })
      }
      throw queryError
    }
    
    const iterations = iterationsResult.rows
    
    // Check if member_program table exists
    const memberProgramTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member_program'
      )
    `)
    
    const hasMemberProgramTable = memberProgramTableCheck.rows[0].exists
    
    // For each iteration, get enrollment counts per day
    const iterationsWithStats = await Promise.all(iterations.map(async (iteration) => {
      const dayCounts = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
      }
      
      if (hasMemberProgramTable) {
        try {
          // Get all enrollments for this iteration
          const enrollmentsResult = await pool.query(`
            SELECT selected_days
            FROM member_program
            WHERE iteration_id = $1 AND selected_days IS NOT NULL
          `, [iteration.id])
          
          // Count enrollments per day
          enrollmentsResult.rows.forEach(row => {
            if (row.selected_days && Array.isArray(row.selected_days)) {
              row.selected_days.forEach(day => {
                const dayLower = day.toLowerCase()
                if (dayCounts.hasOwnProperty(dayLower)) {
                  dayCounts[dayLower]++
                }
              })
            }
          })
        } catch (enrollmentError) {
          console.warn('Error fetching enrollment stats for iteration:', iteration.id, enrollmentError.message)
        }
      }
      
      return {
        ...iteration,
        enrollmentCounts: dayCounts
      }
    }))
    
    res.json({
      success: true,
      data: iterationsWithStats
    })
  } catch (error) {
    console.error('Get iteration stats error:', error)
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
    await ensureProgramCategoriesSchema()
    const { ensurePrimaryDisciplineTagColumn, ensureProgramPricingColumns } = await import('./programs/schema.js')
    await ensurePrimaryDisciplineTagColumn(pool)
    await ensureProgramPricingColumns(pool)
    const taxonomy = await resolveProgramTaxonomy()
    const { archived } = req.query
    
    // Check if description column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = 'description'
    `, [taxonomy.programsTable])
    const hasDescriptionColumn = columnCheck.rows.length > 0
    const isActiveSelect = taxonomy.hasProgramIsActive
      ? 'p.is_active as "isActive",'
      : 'TRUE as "isActive",'
    
    let query = `
      SELECT 
        p.id,
        p.name,
        p.display_name as "displayName",
        ${hasDescriptionColumn ? 'p.description,' : 'NULL as description,'}
        ${isActiveSelect}
        p.archived,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        primary_dt.id as "primarySportId",
        primary_dt.name as "primarySportName",
        p.pricing_max_slots_per_user as "pricingMaxSlotsPerUser",
        p.pricing_slot_cost_monthly_cents as "pricingSlotCostMonthlyCents",
        p.pricing_free_slots_per_user as "pricingFreeSlotsPerUser",
        p.pricing_max_free_slots_total as "pricingMaxFreeSlotsTotal"
      FROM ${taxonomy.programsTable} p
      LEFT JOIN discipline_tag primary_dt ON primary_dt.id = p.primary_discipline_tag_id
    `
    const params = []
    
    if (archived === 'true') {
      query += ' WHERE p.archived = $1'
      params.push(true)
    } else if (archived === 'false') {
      query += ' WHERE p.archived = $1'
      params.push(false)
    }
    
    query += ' ORDER BY p.archived ASC, p.display_name ASC'
    
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

    const { ensurePrimaryDisciplineTagColumn, ensureProgramPricingColumns } = await import('./programs/schema.js')
    const { setProgramPrimarySport, getProgramPrimarySportFields } = await import('./programs/primarySport.js')
    await ensurePrimaryDisciplineTagColumn(pool)
    await ensureProgramPricingColumns(pool)

    const facilityId = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityId.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No facility found'
      })
    }

    const taxonomy = await resolveProgramTaxonomy()

    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = 'description'
    `, [taxonomy.programsTable])
    const hasDescriptionColumn = columnCheck.rows.length > 0

    let query, params
    if (hasDescriptionColumn) {
      query = `
        INSERT INTO ${taxonomy.programsTable} (facility_id, name, display_name, description)
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
        INSERT INTO ${taxonomy.programsTable} (facility_id, name, display_name)
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

    const created = result.rows[0]
    if (value.primarySportId !== undefined) {
      try {
        await setProgramPrimarySport(pool, created.id, value.primarySportId)
      } catch (sportErr) {
        const status = sportErr.statusCode === 400 ? 400 : 500
        return res.status(status).json({
          success: false,
          message: sportErr.message || 'Failed to set primary sport',
        })
      }
    }
    const primarySport = await getProgramPrimarySportFields(pool, created.id)

    res.json({
      success: true,
      message: 'Category created successfully',
      data: { ...created, ...primarySport }
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

    const { ensurePrimaryDisciplineTagColumn, ensureProgramPricingColumns } = await import('./programs/schema.js')
    const { setProgramPrimarySport, getProgramPrimarySportFields } = await import('./programs/primarySport.js')
    await ensurePrimaryDisciplineTagColumn(pool)
    await ensureProgramPricingColumns(pool)

    const updates = []
    const values = []
    let paramCount = 1

    const taxonomy = await resolveProgramTaxonomy()

    if (value.name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      values.push(value.name.toUpperCase().replace(/\s+/g, '_'))
    }
    if (value.displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      values.push(value.displayName)
    }
    
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = 'description'
    `, [taxonomy.programsTable])
    const hasDescriptionColumn = columnCheck.rows.length > 0
    
    if (value.description !== undefined && hasDescriptionColumn) {
      updates.push(`description = $${paramCount++}`)
      values.push(value.description || null)
    }

    if (value.archived !== undefined) {
      updates.push(`archived = $${paramCount++}`)
      values.push(value.archived)
    }

    if (value.isActive !== undefined && taxonomy.hasProgramIsActive) {
      updates.push(`is_active = $${paramCount++}`)
      values.push(value.isActive)
    }

    if (value.pricingMaxSlotsPerUser !== undefined) {
      updates.push(`pricing_max_slots_per_user = $${paramCount++}`)
      values.push(value.pricingMaxSlotsPerUser)
    }
    if (value.pricingSlotCostMonthlyCents !== undefined) {
      updates.push(`pricing_slot_cost_monthly_cents = $${paramCount++}`)
      values.push(value.pricingSlotCostMonthlyCents)
    }
    if (value.pricingFreeSlotsPerUser !== undefined) {
      updates.push(`pricing_free_slots_per_user = $${paramCount++}`)
      values.push(value.pricingFreeSlotsPerUser)
    }
    if (value.pricingMaxFreeSlotsTotal !== undefined) {
      updates.push(`pricing_max_free_slots_total = $${paramCount++}`)
      values.push(value.pricingMaxFreeSlotsTotal)
    }

    const hasPricingUpdate =
      value.pricingMaxSlotsPerUser !== undefined ||
      value.pricingSlotCostMonthlyCents !== undefined ||
      value.pricingFreeSlotsPerUser !== undefined ||
      value.pricingMaxFreeSlotsTotal !== undefined

    if (updates.length === 0 && value.primarySportId === undefined && !hasPricingUpdate) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      })
    }

    let row = null
    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(id)

      const returnDescription = hasDescriptionColumn ? 'description,' : 'NULL as description,'
      const returnIsActive = taxonomy.hasProgramIsActive ? 'is_active as "isActive",' : 'TRUE as "isActive",'
      const result = await pool.query(`
        UPDATE ${taxonomy.programsTable}
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING 
          id,
          name,
          display_name as "displayName",
          ${returnDescription}
          ${returnIsActive}
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
      row = result.rows[0]

      if (value.isActive === false && taxonomy.hasProgramIsActive) {
        await deactivateClassesForProgram(Number(id), taxonomy)
      }
    } else {
      const exists = await pool.query(
        `SELECT id FROM ${taxonomy.programsTable} WHERE id = $1`,
        [id],
      )
      if (exists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        })
      }
    }

    if (value.primarySportId !== undefined) {
      try {
        await setProgramPrimarySport(pool, Number(id), value.primarySportId)
      } catch (sportErr) {
        const status = sportErr.statusCode === 400 ? 400 : 500
        return res.status(status).json({
          success: false,
          message: sportErr.message || 'Failed to set primary sport',
        })
      }
    }

    if (!row) {
      const fetch = await pool.query(
        `SELECT id, name, display_name as "displayName",
          ${hasDescriptionColumn ? 'description,' : 'NULL as description,'}
          ${taxonomy.hasProgramIsActive ? 'is_active as "isActive",' : 'TRUE as "isActive",'}
          archived, created_at as "createdAt", updated_at as "updatedAt",
          pricing_max_slots_per_user as "pricingMaxSlotsPerUser",
          pricing_slot_cost_monthly_cents as "pricingSlotCostMonthlyCents",
          pricing_free_slots_per_user as "pricingFreeSlotsPerUser",
          pricing_max_free_slots_total as "pricingMaxFreeSlotsTotal"
         FROM ${taxonomy.programsTable} WHERE id = $1`,
        [id],
      )
      row = fetch.rows[0]
    } else {
      const pricingFetch = await pool.query(
        `SELECT pricing_max_slots_per_user as "pricingMaxSlotsPerUser",
          pricing_slot_cost_monthly_cents as "pricingSlotCostMonthlyCents",
          pricing_free_slots_per_user as "pricingFreeSlotsPerUser",
          pricing_max_free_slots_total as "pricingMaxFreeSlotsTotal"
         FROM ${taxonomy.programsTable} WHERE id = $1`,
        [id],
      )
      row = { ...row, ...(pricingFetch.rows[0] ?? {}) }
    }
    const primarySport = await getProgramPrimarySportFields(pool, id)

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { ...row, ...primarySport }
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

    const taxonomy = await resolveProgramTaxonomy()

    const result = await pool.query(`
      UPDATE ${taxonomy.programsTable}
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

// Delete category (admin endpoint) — cascades through programs-top delete
app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { deleteTopProgramCascade } = await import('./programs/deleteTopProgram.js')
    const result = await deleteTopProgramCascade(pool, Number(id))
    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    res.json({
      success: true,
      message:
        result.deletedClasses > 0
          ? `Category and ${result.deletedClasses} class(es) deleted successfully`
          : 'Category deleted successfully'
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
    const isOwnAccount = Number(req.adminId) === Number(id)
    if (!isOwnAccount && !(req.isMasterAdmin === true || await hasAdminPermission(req.adminId, 'admins.manage'))) {
      return res.status(403).json({ success: false, message: 'Missing permission: admins.manage' })
    }

    const { error, value } = adminUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      })
    }

    const currentUser = await pool.query(`SELECT id FROM app_user WHERE id = $1`, [id])
    if (currentUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    const isDefaultMaster = await isDefaultMasterUserById(id)
    if (
      isDefaultMaster &&
      (value.firstName || value.lastName || value.username || value.password)
    ) {
      return res.status(400).json({
        success: false,
        message: 'The default master admin account can only update email and phone.',
      })
    }

    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1

    if (!isDefaultMaster && (value.firstName || value.lastName)) {
      const nameResult = await pool.query(`SELECT full_name FROM app_user WHERE id = $1`, [id])
      const currentParts = String(nameResult.rows[0]?.full_name || '').trim().split(/\s+/).filter(Boolean)
      const fullName = `${value.firstName || currentParts[0] || ''} ${value.lastName || currentParts.slice(1).join(' ') || ''}`.trim()
      updates.push(`full_name = $${paramCount++}`)
      values.push(fullName)
    }
    if (value.email) {
      updates.push(`email = $${paramCount++}`)
      values.push(value.email)
    }
    if (value.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`)
      values.push(value.phone || null)
    }
    if (!isDefaultMaster && value.username) {
      // Check if username already exists (excluding current admin, case-insensitive)
      const existing = await pool.query(
        'SELECT id FROM app_user WHERE LOWER(username) = LOWER($1) AND id != $2',
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
    if (!isDefaultMaster && value.password) {
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
      UPDATE app_user
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, full_name, email, phone, username, role::text as role, is_active, created_at, updated_at
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    await ensureMemberForAppUser(id)
    const roles = await getUserRoles(id)
    const adminProfile = await pool.query(`SELECT is_master_admin FROM admin_profile WHERE user_id = $1`, [id])

    res.json({
      success: true,
      data: mapAdminAccountRow({
        ...result.rows[0],
        is_master_admin: adminProfile.rows[0]?.is_master_admin === true,
        roles,
      })
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
  reportError('Global error handler', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
    stack: err?.stack,
  })
  
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

// Start server
const startServer = async () => {
  const workerId = process.env.RENDER_SERVICE_ID || process.pid || 'unknown'
  console.log(`[Server ${workerId}] Starting server initialization on worker ${workerId}...`)
  try {
    await initDatabase()
    // Run after initDatabase so schools/notes/saved_query tables are created even when
    // a late step in initDatabase fails (that function swallows errors and keeps going).
    try {
      await initDbFeatureTables(pool)
    } catch (featureInitError) {
      console.error(`[Server ${workerId}] DB feature tables init failed:`, featureInitError)
    }
    try {
      await ensureCoachClassAssignmentSchema(pool)
    } catch (coachSchemaError) {
      console.error(`[Server ${workerId}] Coach assignment schema init failed:`, coachSchemaError)
    }
    try {
      await ensureCoachingNotificationSchema(pool)
    } catch (notificationSchemaError) {
      console.error(`[Server ${workerId}] Coaching notification schema init failed:`, notificationSchemaError)
    }
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
    if (!hasRegisteredRoute('/api/admin/highlights')) {
      console.error(`[Server ${workerId}] ⚠️ WARNING: Highlights admin API NOT registered — deploy latest backend/server.js`)
    } else {
      console.log(`[Server ${workerId}]   ✅ Highlights API registered (GET/POST /api/admin/highlights)`)
    }
  
  // Only start the HTTP server if not running as a migration script
  if (process.env.RUN_MIGRATION_ONLY !== 'true') {
    app.listen(PORT, () => {
        console.log(`[Server ${workerId}] 🚀 Server running on port ${PORT} (worker ${workerId})`)
        registerEmailPool(pool)
        startAccountInviteReminderScheduler(pool)
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
    if (process.env.ENABLE_MIGRATION_ENDPOINT !== 'true') {
      return res.status(404).json({ success: false, message: 'Not found' })
    }
    const { migrationFile, secretKey } = req.body
    
    // Require a secret key for security (set this as an environment variable)
    const requiredSecret = process.env.MIGRATION_SECRET_KEY
    if (!requiredSecret) {
      return res.status(500).json({ success: false, message: 'Migration endpoint not configured' })
    }
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

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down server...')
  try {
    await pool.end()
    console.log('✅ PostgreSQL connection pool closed')
  } catch (err) {
    console.error('❌ Error closing database pool:', err)
  }
  process.exit(0)
})
