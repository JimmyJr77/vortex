import jwt from 'jsonwebtoken'
import {loadCanonicalAccessContext,resolveCanonicalTokenUserId} from './accessContext.js'
export const payrollPermissionFor = method => method==='GET'?'payroll.view':'payroll.manage'
export async function canonicalAdminPermission(pool,userId,permission) {
  if (!userId) return false
  const access = await loadCanonicalAccessContext(pool, userId)
  if (!access?.portalAccess.admin) return false
  if (access.isOwner) return true
  const roles = [...new Set(access.storageRoles.map((role) => (
    role === 'MASTER_ADMIN' ? 'ADMIN' : role
  )))]

  const result = await pool.query(`
    WITH base_permissions AS (
      SELECT DISTINCT p.key
      FROM role r
      JOIN role_permission rp ON rp.role_id = r.id
      JOIN permission p ON p.id = rp.permission_id
      WHERE r.key = ANY($1::text[])
    ),
    overrides AS (
      SELECT p.key, apo.effect
      FROM app_user_permission_override apo
      JOIN permission p ON p.id = apo.permission_id
      WHERE apo.user_id = $2
    )
    SELECT
      EXISTS (SELECT 1 FROM base_permissions WHERE key = $3) as base_allowed,
      (SELECT effect FROM overrides WHERE key = $3 LIMIT 1) as override_effect
  `, [roles, userId, permission])

  const row = result.rows[0]
  if (row?.override_effect === 'deny') return false
  if (row?.override_effect === 'allow') return true
  return row?.base_allowed === true
}

export function createCanonicalAdminAuth(pool,jwtSecret) {return async (req,res,next)=>{
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No authentication token provided. Admin access required.',
    })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret)
    const userId = await resolveCanonicalTokenUserId(pool, decoded)
    if (userId == null) {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' })
    }

    const access = await loadCanonicalAccessContext(pool, userId)
    if (!access) {
      return res.status(401).json({ success: false, message: 'Invalid token: Admin account not found' })
    }
    if (!access.isActive) {
      return res.status(403).json({ success: false, message: 'Access denied: Admin account is inactive' })
    }
    if (!access.portalAccess.admin) {
      return res.status(403).json({ success: false, message: 'Access denied: Admin privileges required.' })
    }

    req.adminId = access.userId
    req.adminEmail = access.email
    req.isAdmin = true
    req.isMasterAdmin = access.isOwner
    req.canonicalAccess = access
    return next()
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token' })
    }
    console.error('[ADMIN AUTH] Canonical authentication error:', error)
    return res.status(500).json({ success: false, message: 'Authentication error' })
  }
}

}
