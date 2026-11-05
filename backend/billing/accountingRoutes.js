import { listAccountingLines,listAccountingPayments,accountingLineDetail,accountingPaymentDetail,accountingOptions,exportAccountingCsv } from './accountingReport.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'

export function registerAccountingRoutes(app,pool,{jwtSecret,requirePermission}) {
  const read=fn=>async(req,res)=>{
    try {
      const facilityId=requireAdminFacilityScope({facilityId:req.platformAuth?.user?.facility_id})
      res.setHeader('Cache-Control','no-store')
      const data=await fn({facilityId,query:req.query,id:req.params.id,kind:req.query.kind})
      if(data.csv!=null) {
        res.setHeader('Content-Type','text/csv; charset=utf-8')
        res.setHeader('Content-Disposition',`attachment; filename="accounting-${data.view}.csv"`)
        return res.send(data.csv)
      }
      res.json({success:true,data})
    } catch(error) {
      const status=Number.isInteger(error.statusCode)?error.statusCode:500
      if(status===500) console.error('[accounting] report:',error)
      res.status(status).json({success:false,message:status===500?'Accounting report could not be loaded.':error.message})
    }
  }
  for(const [path,fn] of [
    ['/lines',listAccountingLines],['/lines/:id',accountingLineDetail],['/payments',listAccountingPayments],
    ['/payments/:id',accountingPaymentDetail],['/options',accountingOptions],['/export.csv',exportAccountingCsv],
  ]) app.get(`/api/admin/accounting${path}`,...requirePermission(pool,jwtSecret,'billing.view'),read(args=>fn(pool,args)))
}
