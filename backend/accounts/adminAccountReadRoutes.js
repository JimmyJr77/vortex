import {createCanonicalAdminAuth,canonicalAdminPermission} from '../platform/canonicalAdminAuth.js'
import {listAccountDirectory} from './accountDirectory.js'
import {memberDetail,listClasses,classDetail} from '../newAdmin/reads.js'

export function registerAdminAccountReadRoutes(app,pool,{jwtSecret}) {
  const read=(path,permissions,load)=>app.get(path,createCanonicalAdminAuth(pool,jwtSecret),async(req,res)=>{
    try{
      const access=req.canonicalAccess
      if(!access?.portalAccess.admin)return res.status(403).json({success:false,message:'Admin access required.'})
      for(const permission of permissions)if(!await canonicalAdminPermission(pool,access.userId,permission))return res.status(403).json({success:false,message:`Missing permission: ${permission}`})
      res.setHeader('Cache-Control','no-store')
      res.json({success:true,data:await load(access.facilityId,req)})
    }catch(error){const status=error.statusCode||500;res.status(status).json({success:false,message:status===500?'Unable to load account information.':error.message})}
  })
  const base='/api/admin/new-admin'
  read(`${base}/members`,['members.view'],(facility,req)=>listAccountDirectory(pool,{facilityId:facility,query:req.query}))
  read(`${base}/members/:id`,['members.view'],(facility,req)=>memberDetail(pool,facility,req.params.id,req.query))
  read(`${base}/classes`,['classes.view'],(facility,req)=>listClasses(pool,facility,req.query))
  read(`${base}/classes/:id`,['classes.view','members.view'],(facility,req)=>classDetail(pool,facility,req.params.id,req.query))
}
