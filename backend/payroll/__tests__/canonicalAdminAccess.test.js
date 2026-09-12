import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createCanonicalAdminAuth,canonicalAdminPermission,payrollPermissionFor} from '../../platform/canonicalAdminAuth.js'
test('production admin guard enforces current identity, payroll permissions and facility on actual payroll routes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const secret=randomBytes(32).toString('hex')
 const h=await createHarness({adminMiddleware:pool=>{const authenticate=createCanonicalAdminAuth(pool,secret);return (req,res,next)=>authenticate(req,res,async()=>{try{if(req.isMasterAdmin||await canonicalAdminPermission(pool,req.adminId,payrollPermissionFor(req.method)))return next();res.status(403).json({success:false})}catch{res.status(500).json({success:false})}})}});t.after(()=>h.close())
 // Canonical-view row contract fixture. Production view derivation is covered separately by platform tests.
 await h.pool.query(`CREATE TABLE v_app_user_access_context(user_id bigint,facility_id bigint,owner_user_id bigint,email text,full_name text,phone text,username text,primary_storage_role text,storage_roles text[],staff_roles text[],is_active boolean,staff_access_active boolean,member_portal_access_active boolean,is_owner boolean,member_id bigint,family_id bigint,member_portal_status text,can_access_admin_portal boolean,can_access_coach_portal boolean,can_access_member_portal boolean);
 CREATE TABLE app_user_permission_override(user_id bigint,permission_id bigint,effect text);
 INSERT INTO role(key) VALUES('PAYROLL_VIEW_TEST'),('PAYROLL_MANAGE_TEST') ON CONFLICT DO NOTHING;
 INSERT INTO role_permission(role_id,permission_id) SELECT r.id,p.id FROM role r CROSS JOIN permission p WHERE (r.key='PAYROLL_VIEW_TEST' AND p.key='payroll.view') OR (r.key='PAYROLL_MANAGE_TEST' AND p.key IN ('payroll.view','payroll.manage')) ON CONFLICT DO NOTHING`)
 for(const [id,facility,role,active,portal,owner] of [[101,1,'PAYROLL_VIEW_TEST',true,true,false],[202,1,'PAYROLL_MANAGE_TEST',true,true,false],[303,1,'PAYROLL_MANAGE_TEST',false,true,false],[404,1,'NONE',true,true,true],[505,1,'COACH',true,false,false],[606,2,'PAYROLL_VIEW_TEST',true,true,false]])await h.pool.query('INSERT INTO v_app_user_access_context(user_id,facility_id,storage_roles,is_active,can_access_admin_portal,is_owner) VALUES($1,$2,$3,$4,$5,$6)',[id,facility,[role],active,portal,owner])
 const token=id=>jwt.sign({userId:id,role:'MASTER_ADMIN',email:'forged-owner@example.test',facilityId:2},secret,{expiresIn:'1h'})
 const request=(id,path,body,method=body?'POST':'GET')=>fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:`Bearer ${token(id)}`,'Content-Type':'application/json','x-test-facility':'2'},body:body?JSON.stringify(body):undefined})
 assert.equal((await fetch(`${h.url}/api/admin/payroll/dashboard`)).status,401)
 assert.equal((await request(999,'/dashboard')).status,401)
 assert.equal((await request(303,'/dashboard')).status,403);assert.equal((await request(505,'/dashboard')).status,403)
 assert.equal((await request(101,'/dashboard')).status,200)
 const hire={employeeNumber:'GUARDED',legalFirstName:'Guarded',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500}
 assert.equal((await request(101,'/employees',hire)).status,403)
 const created=await request(202,'/employees',hire);assert.equal(created.status,201);const employee=(await created.json()).data
 assert.equal(Number((await h.pool.query('SELECT facility_id FROM payroll_employee WHERE id=$1',[employee.id])).rows[0].facility_id),1)
 const foreign=await request(606,`/employees/${employee.id}/onboarding`);assert.equal(foreign.status,404)
 await h.pool.query("INSERT INTO app_user_permission_override SELECT 202,id,'deny' FROM permission WHERE key='payroll.manage'")
 assert.equal((await request(202,`/employees/${employee.id}`,{jobTitle:'Blocked'},'PATCH')).status,403)
 await h.pool.query("INSERT INTO app_user_permission_override SELECT 101,id,'allow' FROM permission WHERE key='payroll.manage'")
 assert.equal((await request(101,`/employees/${employee.id}`,{jobTitle:'Allowed'},'PATCH')).status,200)
 await h.pool.query('UPDATE v_app_user_access_context SET is_active=false WHERE user_id=101')
 assert.equal((await request(101,'/dashboard')).status,403)
 assert.equal((await request(404,'/dashboard')).status,200)
 const expired=jwt.sign({userId:404},secret,{expiresIn:-1})
 assert.equal((await fetch(`${h.url}/api/admin/payroll/dashboard`,{headers:{Authorization:`Bearer ${expired}`}})).status,401)
 for(const method of ['POST','PATCH','PUT','DELETE','HEAD'])assert.equal(payrollPermissionFor(method),'payroll.manage')
 assert.equal(payrollPermissionFor('GET'),'payroll.view')
})
