/**
 * Phase G form-review + Phase H coach assistant routes.
 */
import crypto from 'crypto'
import { llmCoachAssistant } from './aiService.js'
import { searchEmbeddingChunks, syncMemberEmbeddings, upsertEmbeddingChunk } from './embeddingService.js'

export function registerCoachingPhaseGHRoutes(app, pool, deps) {
  const { ok, bad, num, auth, can, createInAppNotification, resolveAssignedCoachUserIdsForMember } = deps

  function cloudinarySignature(folder) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) return { configured: false }
    const timestamp = Math.floor(Date.now() / 1000)
    const toSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
    return {
      configured: true,
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    }
  }

  async function coachCanAccessFormReview(submission, coachUserId, facilityId) {
    if (submission.visibility_scope === 'coaching_circle') return true
    const assigned = await resolveAssignedCoachUserIdsForMember(submission.member_id, facilityId)
    return assigned.includes(Number(coachUserId))
  }

  async function loadFormReviewSubmission(id, facilityId) {
    const r = await pool.query(
      `
        SELECT frs.*,
          m.first_name, m.last_name,
          e.name AS exercise_name
        FROM coaching.form_review_submission frs
        JOIN public.member m ON m.id = frs.member_id
        LEFT JOIN coaching.exercise e ON e.id = frs.exercise_id
        WHERE frs.id = $1 AND frs.facility_id = $2
      `,
      [id, facilityId],
    )
    return r.rows[0] ?? null
  }

  // Member upload signature (short form-check videos)
  app.get('/api/member/training/form-review/upload-signature', auth, (req, res) => {
    ok(res, cloudinarySignature('coaching/form-review'))
  })

  app.get('/api/member/training/form-review/exercise-options', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const familyId = ctx.user.family_id
      const facilityId = ctx.user.facility_id
      const result = await pool.query(
        `
          SELECT DISTINCT e.id, e.name
          FROM coaching.plan_assignment pa
          JOIN coaching.workout w ON pa.assignable_type = 'workout' AND pa.assignable_id = w.id
          JOIN coaching.workout_block wb ON wb.workout_id = w.id
          JOIN coaching.workout_item wi ON wi.block_id = wb.id
          JOIN coaching.exercise e ON e.id = wi.exercise_id
          WHERE pa.visibility = 'athlete' AND pa.status <> 'cancelled' AND w.facility_id = $3
            AND (
              (pa.target_type = 'member' AND pa.target_id = $1)
              OR (pa.target_type = 'family' AND $2::bigint IS NOT NULL AND pa.target_id = $2)
              OR (pa.target_type = 'class' AND EXISTS (
                SELECT 1 FROM public.member_program mp
                WHERE mp.member_id = $1 AND (mp.program_id = pa.target_id OR mp.iteration_id = pa.target_id)
              ))
            )
          ORDER BY e.name
        `,
        [memberId, familyId, facilityId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/member/training/form-reviews', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const result = await pool.query(
        `
          SELECT frs.*, e.name AS exercise_name,
            fr.note AS coach_note, fr.criterion_scores, fr.reviewed_at
          FROM coaching.form_review_submission frs
          LEFT JOIN coaching.exercise e ON e.id = frs.exercise_id
          LEFT JOIN coaching.form_review_response fr ON fr.submission_id = frs.id
          WHERE frs.member_id = $1
          ORDER BY frs.created_at DESC
          LIMIT 50
        `,
        [memberId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/member/training/form-reviews', auth, async (req, res) => {
    try {
      const ctx = req.platformAuth
      const memberId = num(ctx.user.member_id ?? ctx.user.id)
      const facilityId = ctx.user.facility_id
      const exerciseId = num(req.body?.exercise_id)
      const subject = req.body?.subject ? String(req.body.subject).trim() : null
      const videoUrl = String(req.body?.video_url || '').trim()
      const videoPublicId = req.body?.video_public_id ? String(req.body.video_public_id) : null
      const durationSeconds = num(req.body?.duration_seconds)
      const assignmentId = num(req.body?.assignment_id)

      if (!videoUrl) return bad(res, 'video_url is required.')
      if (!exerciseId && !subject) return bad(res, 'Pick an exercise or provide a subject for a general upload.')
      if (durationSeconds != null && durationSeconds > 60) return bad(res, 'Video must be 60 seconds or less.')

      if (exerciseId) {
        const pending = await pool.query(
          `SELECT id FROM coaching.form_review_submission
           WHERE member_id = $1 AND exercise_id = $2 AND status = 'pending'`,
          [memberId, exerciseId],
        )
        if (pending.rows.length > 0) return bad(res, 'You already have a pending submission for this exercise.', 409)
      }

      const inserted = await pool.query(
        `
          INSERT INTO coaching.form_review_submission
            (facility_id, member_id, exercise_id, assignment_id, subject, video_url, video_public_id, duration_seconds)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          facilityId,
          memberId,
          exerciseId,
          assignmentId,
          subject,
          videoUrl,
          videoPublicId,
          durationSeconds,
        ],
      )
      const submission = inserted.rows[0]

      const memberRow = await pool.query(`SELECT first_name, last_name FROM public.member WHERE id = $1`, [memberId])
      const name = memberRow.rows[0]
        ? `${memberRow.rows[0].first_name || ''} ${memberRow.rows[0].last_name || ''}`.trim()
        : 'Athlete'
      const coachIds = await resolveAssignedCoachUserIdsForMember(memberId, facilityId)
      const label = exerciseId
        ? (await pool.query(`SELECT name FROM coaching.exercise WHERE id = $1`, [exerciseId])).rows[0]?.name
        : subject
      await Promise.all(
        coachIds.map((coachUserId) =>
          createInAppNotification({
            facilityId,
            recipientUserId: coachUserId,
            kind: 'system',
            title: `Form video: ${name}`,
            body: label || 'New form-check submission',
            payload: { type: 'form_review', submission_id: submission.id, member_id: memberId },
          }),
        ),
      )

      ok(res, submission)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/form-reviews', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const status = req.query.status ? String(req.query.status) : 'pending'
      const result = await pool.query(
        `
          SELECT frs.*, m.first_name, m.last_name, e.name AS exercise_name
          FROM coaching.form_review_submission frs
          JOIN public.member m ON m.id = frs.member_id
          LEFT JOIN coaching.exercise e ON e.id = frs.exercise_id
          WHERE frs.facility_id = $1 AND frs.status = $2
          ORDER BY frs.created_at ASC
          LIMIT 100
        `,
        [facilityId, status],
      )
      const filtered = []
      for (const row of result.rows) {
        if (await coachCanAccessFormReview(row, coachUserId, facilityId)) filtered.push(row)
      }
      ok(res, filtered)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/coach/form-reviews/:id', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const submission = await loadFormReviewSubmission(num(req.params.id), facilityId)
      if (!submission) return bad(res, 'Submission not found.', 404)
      if (!await coachCanAccessFormReview(submission, coachUserId, facilityId)) {
        return bad(res, 'Not authorized for this submission.', 403)
      }
      const response = await pool.query(
        `SELECT * FROM coaching.form_review_response WHERE submission_id = $1 ORDER BY reviewed_at DESC LIMIT 1`,
        [submission.id],
      )
      const rubrics = await pool.query(
        `SELECT * FROM coaching.rubric WHERE facility_id = $1 AND archived = FALSE ORDER BY name`,
        [facilityId],
      )
      const rubricIds = rubrics.rows.map((r) => Number(r.id))
      let criteria = []
      if (rubricIds.length > 0) {
        const cr = await pool.query(
          `SELECT * FROM coaching.rubric_criterion WHERE rubric_id = ANY($1::bigint[]) ORDER BY sort_order, id`,
          [rubricIds],
        )
        criteria = cr.rows
      }
      ok(res, {
        submission,
        response: response.rows[0] ?? null,
        rubrics: rubrics.rows.map((r) => ({
          ...r,
          criteria: criteria.filter((c) => Number(c.rubric_id) === Number(r.id)),
        })),
      })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/form-reviews/:id/review', ...can('athlete_grading.manage'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const submissionId = num(req.params.id)
      const submission = await loadFormReviewSubmission(submissionId, facilityId)
      if (!submission) return bad(res, 'Submission not found.', 404)
      if (!await coachCanAccessFormReview(submission, coachUserId, facilityId)) {
        return bad(res, 'Not authorized for this submission.', 403)
      }
      if (submission.status !== 'pending') return bad(res, 'Submission is not pending review.')

      const rubricId = num(req.body?.rubric_id)
      const criterionScores = req.body?.criterion_scores ?? {}
      const note = req.body?.note ? String(req.body.note) : null

      const response = await pool.query(
        `
          INSERT INTO coaching.form_review_response
            (submission_id, coach_user_id, rubric_id, criterion_scores, note)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          RETURNING *
        `,
        [submissionId, coachUserId, rubricId, JSON.stringify(criterionScores), note],
      )

      await pool.query(
        `UPDATE coaching.form_review_submission SET status = 'reviewed', updated_at = now() WHERE id = $1`,
        [submissionId],
      )

      await createInAppNotification({
        facilityId,
        recipientMemberId: submission.member_id,
        kind: 'system',
        title: 'Coach reviewed your form video',
        body: note ? note.slice(0, 160) : 'Your coach left feedback on your submission.',
        payload: { type: 'form_review', submission_id: submissionId },
      })

      const embedContent = [
        submission.exercise_name ? `Exercise: ${submission.exercise_name}` : submission.subject,
        note ? `Coach note: ${note}` : null,
        Object.keys(criterionScores).length ? `Scores: ${JSON.stringify(criterionScores)}` : null,
      ].filter(Boolean).join(' · ')
      if (embedContent) {
        await upsertEmbeddingChunk(pool, {
          facilityId,
          memberId: submission.member_id,
          sourceType: 'form_review',
          sourceId: Number(response.rows[0].id),
          content: embedContent,
        }).catch(() => {})
      }

      ok(res, { submission: { ...submission, status: 'reviewed' }, response: response.rows[0] })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/coach/form-reviews/:id/share-circle', ...can('athlete_grading.manage'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const submissionId = num(req.params.id)
      const submission = await loadFormReviewSubmission(submissionId, facilityId)
      if (!submission) return bad(res, 'Submission not found.', 404)
      const assigned = await resolveAssignedCoachUserIdsForMember(submission.member_id, facilityId)
      if (!assigned.includes(coachUserId)) return bad(res, 'Only the assigned coach can share with the coaching circle.', 403)
      const updated = await pool.query(
        `UPDATE coaching.form_review_submission SET visibility_scope = 'coaching_circle', updated_at = now() WHERE id = $1 RETURNING *`,
        [submissionId],
      )
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Coach assistant (Phase H)
  app.get('/api/coach/ai/assistant/:memberId/history', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const memberId = num(req.params.memberId)
      const result = await pool.query(
        `
          SELECT role, content, created_at
          FROM coaching.assistant_message
          WHERE facility_id = $1 AND member_id = $2 AND coach_user_id = $3
          ORDER BY created_at ASC
          LIMIT 40
        `,
        [facilityId, memberId, coachUserId],
      )
      ok(res, result.rows)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/ai/embeddings/sync/:memberId', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const memberId = num(req.params.memberId)
      const stats = await syncMemberEmbeddings(pool, facilityId, memberId)
      ok(res, stats)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/coach/ai/assistant/:memberId', ...can('coach_insights.view'), async (req, res) => {
    try {
      const facilityId = req.platformAuth.user.facility_id
      const coachUserId = Number(req.platformAuth.user.id)
      const memberId = num(req.params.memberId)
      const question = String(req.body?.message || '').trim()
      if (!question) return bad(res, 'message is required.')

      const memberRow = await pool.query(
        `SELECT first_name, last_name FROM public.member WHERE id = $1 AND facility_id = $2`,
        [memberId, facilityId],
      )
      if (memberRow.rows.length === 0) return bad(res, 'Member not found.', 404)
      const athleteName = `${memberRow.rows[0].first_name || ''} ${memberRow.rows[0].last_name || ''}`.trim() || 'Athlete'

      const historyRows = await pool.query(
        `
          SELECT role, content FROM coaching.assistant_message
          WHERE facility_id = $1 AND member_id = $2 AND coach_user_id = $3
          ORDER BY created_at DESC LIMIT 8
        `,
        [facilityId, memberId, coachUserId],
      )
      const history = historyRows.rows.reverse()

      let chunks = []
      try {
        chunks = await searchEmbeddingChunks(pool, { facilityId, memberId, queryText: question, limit: 8 })
      } catch {
        chunks = []
      }
      if (chunks.length === 0) {
        await syncMemberEmbeddings(pool, facilityId, memberId).catch(() => {})
        try {
          chunks = await searchEmbeddingChunks(pool, { facilityId, memberId, queryText: question, limit: 8 })
        } catch {
          chunks = []
        }
      }

      const llmAnswer = await llmCoachAssistant({
        athleteName,
        question,
        contextChunks: chunks,
        history,
      })

      let answer
      if (llmAnswer) {
        answer = llmAnswer
      } else {
        const top = chunks.slice(0, 3).map((c) => c.content).join('; ')
        answer = top
          ? `Based on recent data: ${top}. (LLM not configured — showing retrieved context only.)`
          : 'No athlete context found yet. Log training, assessments, or wellness check-ins to ground answers.'
      }

      await pool.query(
        `INSERT INTO coaching.assistant_message (facility_id, member_id, coach_user_id, role, content) VALUES ($1, $2, $3, 'user', $4)`,
        [facilityId, memberId, coachUserId, question],
      )
      await pool.query(
        `INSERT INTO coaching.assistant_message (facility_id, member_id, coach_user_id, role, content) VALUES ($1, $2, $3, 'assistant', $4)`,
        [facilityId, memberId, coachUserId, answer],
      )

      ok(res, { answer, sources: chunks.slice(0, 5), usedLlm: Boolean(llmAnswer) })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })
}
