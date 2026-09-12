import rateLimit from 'express-rate-limit'
import {preparerPacket,previewPreparer,signPreparer,preparerDocument,recordPreparerPage} from './i9Preparers.js'
export function registerPayrollPreparerRoutes(app,pool){
 const limit=rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:true,legacyHeaders:false})
 const route=work=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');let db
  try{const header=String(req.headers.authorization||''),token=header.startsWith('Bearer ')?header.slice(7):'';db=await pool.connect();await db.query('BEGIN');const data=await work(db,token,req.body||{});await db.query('COMMIT');if(data.bytes){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${data.filename}"`);res.send(data.bytes)}else res.json({success:true,data})}
  catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to process the preparer certification.'})}finally{db?.release()}
 }
 app.get('/api/payroll/preparer/me',limit,route(preparerPacket))
 app.post('/api/payroll/preparer/preview',limit,route(previewPreparer))
 app.post('/api/payroll/preparer/page',limit,route(recordPreparerPage))
 app.post('/api/payroll/preparer/sign',limit,route(signPreparer))
 app.get('/api/payroll/preparer/document',limit,route(preparerDocument))
}
