import {createCanonicalAdminAuth,canonicalAdminPermission} from '../platform/canonicalAdminAuth.js'
import {jackrabbitHistory} from '../newAdmin/jackrabbitHistory.js'

export function registerJackrabbitHistoryRoutes(app,pool,{jwtSecret}) {
  app.get('/api/admin/jackrabbit-history',createCanonicalAdminAuth(pool,jwtSecret),async(req,res)=>{
    try{
      const access=req.canonicalAccess
      if(!access?.portalAccess.admin)return res.status(403).json({success:false,message:'Admin access required.'})
      if(!await canonicalAdminPermission(pool,access.userId,'members.view')||!await canonicalAdminPermission(pool,access.userId,'billing.view'))return res.status(403).json({success:false,message:'Member and billing read access required.'})
      res.setHeader('Cache-Control','no-store')
      res.json({success:true,data:await jackrabbitHistory(pool,access.facilityId,req.query)})
    }catch(error){const status=error.statusCode||500;res.status(status).json({success:false,message:status===500?'Unable to load Jackrabbit history.':error.message})}
  })
}
