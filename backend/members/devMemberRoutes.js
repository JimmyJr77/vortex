import {
  clearDevTestMembers,
  DEV_TEST_PASSWORD,
  isDevEnvironment,
  seedDevTestMembers,
} from './seedDevTestMembers.js'

export function registerDevMemberRoutes(app, pool) {
  app.post('/api/admin/dev/seed-test-members', async (req, res) => {
    if (!isDevEnvironment()) {
      return res.status(404).json({ success: false, message: 'Not found' })
    }
    try {
      const replace = req.body?.replace !== false
      const result = await seedDevTestMembers(pool, { replace })
      res.json({
        success: true,
        data: {
          ...result,
          hint: `All dev test logins use password: ${DEV_TEST_PASSWORD}`,
        },
      })
    } catch (err) {
      console.error('[dev] seed-test-members:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to seed dev test members',
      })
    }
  })

  app.delete('/api/admin/dev/seed-test-members', async (req, res) => {
    if (!isDevEnvironment()) {
      return res.status(404).json({ success: false, message: 'Not found' })
    }
    try {
      const result = await clearDevTestMembers(pool)
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[dev] clear-test-members:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to clear dev test members',
      })
    }
  })

  app.get('/api/admin/dev/seed-test-members/status', async (req, res) => {
    if (!isDevEnvironment()) {
      return res.status(404).json({ success: false, message: 'Not found' })
    }
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM member WHERE internal_flags = 'dev_test_seed'`,
      )
      res.json({
        success: true,
        data: { count: Number(result.rows[0]?.count ?? 0), available: true },
      })
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to check dev test members' })
    }
  })
}
