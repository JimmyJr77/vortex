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
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'vortex-secret-key-change-in-production'

const app = express()
const PORT = process.env.PORT || 3001

// CORS configuration - must be before helmet
const allowedOrigins = [
  'http://localhost:5173',
  'https://vortexathletics.com',
  'https://www.vortexathletics.com'
]

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman, curl, etc)
    if (!origin) return callback(null, true)
    
    // Log the origin for debugging
    console.log('CORS request from origin:', origin)
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}`)
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
if (import.meta.url === `file://${process.argv[1]}` || !process.env.RUN_MIGRATION_ONLY) {
  startServer().catch(console.error)
}

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
