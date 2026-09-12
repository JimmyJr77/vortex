import {registerW2ProviderIntake,w2ProviderPath} from '../w2NoticeProviderIntake.js'
// Local-only payroll integration harness. Never reads application .env files.
import express from 'express'
import pg from 'pg'
import fs from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { registerQuickbooksCallback } from '../quickbooks.js'
import { registerPayrollRoutes } from '../registerRoutes.js'
import { registerPayrollEmployeeRoutes } from '../employeeRoutes.js'

export async function createHarness({retirementReceiptReader=async()=>({status:'UNAVAILABLE'}),retirementAllocationTransfer=async()=>({status:'TRANSPORT_UNCERTAIN'}),retirementSftpVerifier=async()=>({status:'UNAVAILABLE'}),remittanceNow=()=>new Date(),retirementNow=()=>new Date(),quickbooksFetcher=async()=>{throw new Error('Synthetic QuickBooks transport unavailable')},databaseNow,providerIntake,adminMiddleware,invitationSender,carrierNoticeSender,payrollNow=()=>new Date('2051-01-01T12:00:00Z'),paymentFetcher=async()=>{throw new Error('Synthetic payment transport unavailable')}}={}) {
 // Optional fixed database clock for historical browser fixtures; scoped to this schema.
 if(databaseNow!==undefined&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(databaseNow)||!Number.isFinite(Date.parse(databaseNow))))throw new Error('Use an ISO UTC timestamp for the isolated database clock.')
 const databaseUrl=process.env.PAYROLL_TEST_DATABASE_URL
 if(!databaseUrl)throw new Error('Set PAYROLL_TEST_DATABASE_URL to an isolated local database.')
 const parsed=new URL(databaseUrl)
 if(!['127.0.0.1','localhost'].includes(parsed.hostname))throw new Error('Payroll harness requires a localhost database.')
 const schema=`payroll_test_${randomBytes(8).toString('hex')}`
 const root=new pg.Pool({connectionString:databaseUrl})
 await root.query(`CREATE SCHEMA ${schema}`)
 const pool=new pg.Pool({connectionString:databaseUrl,options:`-c search_path=${schema},${databaseNow?'pg_catalog,':''}public`})
 if(databaseNow)await pool.query(`CREATE FUNCTION now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT '${new Date(databaseNow).toISOString()}'::timestamptz $$`)
 await pool.query(`CREATE TABLE facility(id BIGINT PRIMARY KEY,timezone TEXT); CREATE TABLE permission(id BIGSERIAL PRIMARY KEY,key TEXT UNIQUE,description TEXT); CREATE TABLE role(id BIGSERIAL PRIMARY KEY,key TEXT UNIQUE); CREATE TABLE role_permission(role_id BIGINT,permission_id BIGINT,UNIQUE(role_id,permission_id)); INSERT INTO facility VALUES (1,'America/New_York'),(2,'America/New_York')`)
 for(const file of ['812_payroll_operations.sql','813_payroll_onboarding.sql'])await pool.query(await fs.readFile(new URL(`../../migrations/${file}`,import.meta.url),'utf8'))
 // Remove historical seed employees in this isolated fixture only.
 await pool.query('TRUNCATE payroll_employee CASCADE')
 await pool.query('TRUNCATE payroll_compliance_task CASCADE')
 const app=express(),parseJson=express.json({limit:'10mb'});app.use((req,res,next)=>req.originalUrl?.split('?')[0]===w2ProviderPath?next():parseJson(req,res,next))
 app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:4173');res.setHeader('Access-Control-Allow-Headers','authorization,content-type,x-test-facility');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next()})
 app.use('/api/admin',adminMiddleware?adminMiddleware(pool):(req,res,next)=>{if(req.headers.authorization!=='Bearer payroll-test-admin')return res.status(401).json({success:false,message:'Test admin token required'});req.canonicalAccess={facilityId:Number(req.headers['x-test-facility']||1)};req.adminId=99;next()})
 app.post('/api/admin/payroll/testing/reset',async(req,res)=>{
  try {await pool.query('TRUNCATE payroll_automation_run,payroll_leave_year_policy,payroll_leave_year_close,payroll_schedule_version,payroll_employee,payroll_pay_period,payroll_alert,payroll_quickbooks_connection,payroll_audit_log,payroll_tax_deposit,payroll_tax_filing,payroll_compliance_task,payroll_federal_deposit_schedule,payroll_md_ui_reporting_config,payroll_md_withholding_config CASCADE');res.json({success:true})}
  catch{res.status(500).json({success:false})}
 })
 registerW2ProviderIntake(app,pool,providerIntake)
 registerPayrollRoutes(app,pool,{retirementReceiptReader,retirementAllocationTransfer,retirementSftpVerifier,remittanceNow,now:payrollNow,invitationSender,carrierNoticeSender,paymentFetcher,quickbooksFetcher});registerPayrollEmployeeRoutes(app,pool,{paymentFetcher,retirementNow});registerQuickbooksCallback(app,pool,{fetcher:quickbooksFetcher})
 const server=await new Promise(resolve=>{const s=app.listen(Number(process.env.PAYROLL_TEST_PORT)||0,'127.0.0.1',()=>resolve(s))})
 return {pool,url:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end()}}
}
