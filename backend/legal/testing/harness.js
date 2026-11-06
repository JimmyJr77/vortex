import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { registerStaffLegalRoutes } from '../registerRoutes.js'
import { hashPayrollToken } from '../../payroll/employeeAuth.js'

export async function legalHarness() {
  const connectionString = process.env.LEGAL_TEST_DATABASE_URL
  if (!connectionString || !['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname)) throw new Error('Use an isolated localhost legal test database.')
  const schema = `legal_test_${crypto.randomBytes(6).toString('hex')}`
  const root = new pg.Pool({ connectionString }); await root.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` })
  await pool.query(`CREATE TABLE facility(id bigint PRIMARY KEY); INSERT INTO facility VALUES(1),(2);
    CREATE TABLE payroll_settings(facility_id bigint PRIMARY KEY); INSERT INTO payroll_settings VALUES(1),(2);
    CREATE TABLE payroll_employee(id bigint PRIMARY KEY,facility_id bigint,employment_status text,legal_first_name text,legal_last_name text,personal_email text);
    INSERT INTO payroll_employee VALUES(10,1,'ACTIVE','Linked','Coach','linked@example.test'),(11,1,'ACTIVE','Payroll','Only','payroll@example.test'),(12,1,'TERMINATED','Former','Staff','former@example.test'),(20,2,'ACTIVE','Other','Facility','other@example.test');
    CREATE TABLE payroll_employee_account_link(employee_id bigint PRIMARY KEY,facility_id bigint,user_id bigint);
    INSERT INTO payroll_employee_account_link VALUES(10,1,1);
    CREATE TABLE payroll_employee_session(id bigserial PRIMARY KEY,facility_id bigint,employee_id bigint,token_hash text,expires_at timestamptz,revoked_at timestamptz,last_used_at timestamptz);
    CREATE TABLE v_app_user_access_context(user_id bigint,facility_id bigint,full_name text,email text,staff_roles text[],is_active boolean,can_access_admin_portal boolean,can_access_coach_portal boolean);
    INSERT INTO v_app_user_access_context VALUES(1,1,'Linked Coach','linked@example.test',ARRAY['COACH'],true,false,true),(2,1,'Admin Staff','admin@example.test',ARRAY['ADMINISTRATOR'],true,true,false),(3,1,'Shared Email Coach','linked@example.test',ARRAY['COACH'],true,false,true),(4,2,'Other Facility','other@example.test',ARRAY['COACH'],true,false,true);`)
  const migration = await fs.readFile(new URL('../../migrations/840_staff_legal_signatures.sql', import.meta.url), 'utf8')
  await pool.query(migration); await pool.query(migration)
  for (const [employee, token] of [[10, 'linked-payroll'], [11, 'payroll-only'], [12, 'former-payroll']]) await pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')", [employee, hashPayrollToken(token)])
  const app = express(); app.use(express.json())
  app.use((req,res,next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:55440')
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if(req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  const staffAuth = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    const ids = { coach: 1, admin: 2, shared: 3, other: 4, member: 5 }
    const id = ids[token]
    if (!id) return res.status(401).json({ success: false })
    req.platformAuth = { user: { id, facility_id: token === 'other' ? 2 : 1, full_name: token }, portalAccess: { admin: token === 'admin', coach: !['admin', 'member'].includes(token) } }
    next()
  }
  const adminOnly = (req, res, next) => req.platformAuth?.portalAccess.admin ? next() : res.status(403).json({ success: false })
  registerStaffLegalRoutes(app, pool, { staffAuth, adminAuth: [staffAuth, adminOnly] })
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  return { app, pool, url: `http://127.0.0.1:${server.address().port}`, close: async () => { await new Promise(r => server.close(r)); await pool.end(); await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end() } }
}

