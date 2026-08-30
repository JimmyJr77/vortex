#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import Stripe from 'stripe'
import { repairMembershipOwnershipAndAllocations } from '../billing/membershipPaymentRepair.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function argument(name) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
}

function numberList(name) {
  return String(argument(name) ?? '').split(',').map(Number).filter((value) => Number.isFinite(value) && value > 0)
}

function needsSsl(value) {
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
}

const apply = process.argv.includes('--apply')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('A database connection URL is required.')
const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_PROD || process.env.STRIPE_SECRET_KEY_TEST || null
const stripe = apply && stripeKey ? new Stripe(stripeKey) : null
const pool = new pg.Pool({ connectionString, ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false })

try {
  const report = await repairMembershipOwnershipAndAllocations(pool, stripe, {
    apply,
    accountIds: numberList('account-ids'),
    familyIds: numberList('family-ids'),
    from: argument('from'),
    through: argument('through'),
  })
  console.log(JSON.stringify(report, null, 2))
  if (apply && report.failed.length) process.exitCode = 1
} finally {
  await pool.end()
}
