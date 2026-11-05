import fs from 'node:fs/promises'
import pg from 'pg'
import { migrationSnapshot,compareSnapshots,planLeadOwnership,applyLeadOwnership,rollbackLeadOwnership,configurePublicLeadFacility,validateRehearsalDatabaseUrl } from './migrationAudit.js'

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...value]=arg.replace(/^--/,'').split('=');return [key,value.length?value.join('='):true]}))
if(args.compare) {
  const [before,after]=String(args.compare).split(',')
  if(!before||!after) throw new Error('Use --compare=before.json,after.json')
  const result=compareSnapshots(JSON.parse(await fs.readFile(before,'utf8')),JSON.parse(await fs.readFile(after,'utf8')))
  console.log(JSON.stringify(result,null,2));process.exitCode=result.matches?0:1
} else {
  const url=process.env.NEW_ADMIN_DATABASE_URL
  if(!url) throw new Error('Set NEW_ADMIN_DATABASE_URL to the explicit rehearsal database. This tool does not load ambient production credentials.')
  const pool=new pg.Pool({connectionString:validateRehearsalDatabaseUrl(url),max:2})
  try {
    let result
    if(args.snapshot) {
      result=await migrationSnapshot(pool)
      await fs.writeFile(String(args.snapshot),JSON.stringify(result,null,2)+'\n',{mode:0o600})
      result={snapshot:String(args.snapshot),tables:Object.keys(result.tables),missingTables:result.missingTables,anomalies:result.anomalies}
    } else if(args.rollback) result=await rollbackLeadOwnership(pool,String(args.rollback))
    else if(args['public-facility']) {
      if(!args.apply) result={mode:'dry-run',publicLeadFacilityId:Number(args['public-facility'])}
      else result=await configurePublicLeadFacility(pool,args['public-facility'])
    }
    else {
      const options={facilityId:args.facility,leadIds:args['lead-ids']?String(args['lead-ids']).split(','):[]}
      result=args.apply?await applyLeadOwnership(pool,options):await planLeadOwnership(pool,options)
      result={mode:args.apply?'apply':'dry-run',...result}
    }
    console.log(JSON.stringify(result,null,2))
  }finally{await pool.end()}
}
