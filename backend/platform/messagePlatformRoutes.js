/**
 * Message platform HTTP routes — tags, read state, search, collaboration, events.
 */

import { ensureCoachingMessagePlatformSchema } from './coachingSchemaEnsure.js'
import {
  ensureDefaultTags,
  setThreadTags,
  markThreadRead,
  enrichThreadsWithUnread,
  enrichThreadsWithTags,
  linkThreadToObject,
  pinMessage,
  createMessagePinGroup,
  deleteMessagePinGroup,
  loadThreadPinGroupsResponse,
  searchMessages,
  listMessageFiles,
  acknowledgeMessage,
  getNotificationPreferences,
  updateNotificationPreferences,
  addMessageReaction,
  removeMessageReaction,
  loadMessageReactions,
  voteMessagePoll,
  loadMessagePoll,
  createMessagePoll,
  listThreadPolls,
  setMessagePollClosed,
  createMessageChecklist,
  loadMessageChecklist,
  listThreadSignupSheets,
  setMessageChecklistClosed,
  upsertSignupResponse,
  claimChecklistItem,
  createCollaborationMessage,
  listThreadFaq,
  createThreadFaq,
  updateThreadFaq,
  deleteThreadFaq,
  listFacilityFaqLibrary,
  listMemberMasterFaqs,
  createFacilityFaqEntry,
  deleteFacilityFaqEntry,
  logMessageAudit,
  exportMessageAudit,
  getMessageRetentionPolicy,
} from './messagePlatform.js'
import { HIGHLIGHT_NOTIFICATION_SQL } from './notificationHighlight.js'
import {
  provisionEventThreads,
  getEventThreads,
  subscribeMemberToEventThreads,
  getEventChatStatus,
} from './messageEventThreads.js'
import {
  listEventCalendarItems,
  createEventCalendarItem,
  updateEventCalendarItem,
  deleteEventCalendarItem,
  listUpcomingCalendarItemsForMember,
  upsertEventRsvp,
  getEventRsvp,
  listEventRsvps,
  listCalendarInboxRows,
} from './messageEventCalendar.js'
import {
  getSchedulingFormThread,
  postSchedulingSystemMessage,
  provisionSchedulingFormThread,
} from './messageSchedulingThreads.js'
import { broadcastMessageEvent } from './messageRealtime.js'
import {
  memberIsThreadParticipant,
  coachCanAccessThreadWithParticipants,
  loadEnrichedMessageById,
} from './messageThreads.js'

let emitMessageCreatedImpl = (payload) => {
  broadcastMessageEvent({ type: 'message.created', ...payload })
}

/** Hook for message send — broadcasts message.created. */
export function emitMessageCreated(payload) {
  emitMessageCreatedImpl(payload)
}

export function registerMessagePlatformRoutes(app, pool, deps) {
  const {
    ok,
    bad,
    num,
    auth,
    isStaffAdmin,
    createInAppNotification,
    sendEmail,
    memberCanAccessMessageThread,
    coachHasThreadAccess,
  } = deps

  if (deps.broadcastMessageEvent) {
    emitMessageCreatedImpl = (payload) => deps.broadcastMessageEvent({ type: 'message.created', ...payload })
  }

  async function ensureSchema() {
    await ensureCoachingMessagePlatformSchema(pool)
  }

  function coachViewer(req) {
    return { userId: Number(req.platformAuth.user.id) }
  }

  function memberViewer(req) {
    const ctx = req.platformAuth
    return { memberId: num(ctx.user.member_id ?? ctx.user.id) }
  }

  function adminViewer(req) {
    return { userId: Number(req.platformAuth.user.id) }
  }

  async function loadThreadForFacility(threadId, facilityId) {
    const r = await pool.query(
      `SELECT * FROM coaching.message_thread WHERE id = $1 AND facility_id = $2`,
      [threadId, facilityId],
    )
    return r.rows[0] ?? null
  }

  async function coachCanViewThread(thread, coachUserId) {
    return coachHasThreadAccess
      ? coachHasThreadAccess(thread, coachUserId)
      : coachCanAccessThreadWithParticipants(pool, thread, coachUserId)
  }

  async function memberCanViewThread(threadId, memberId, thread) {
    const isParticipant = await memberIsThreadParticipant(pool, threadId, memberId)
    if (isParticipant) return true
    return memberCanAccessMessageThread(memberId, thread.member_id)
  }

  async function assertThreadAccess(req, res, threadId, portal) {
    const facilityId = req.platformAuth.user.facility_id
    const thread = await loadThreadForFacility(threadId, facilityId)
    if (!thread) {
      bad(res, 'Thread not found.', 404)
      return null
    }
    if (portal === 'admin') {
      if (!isStaffAdmin(req.platformAuth)) {
        bad(res, 'Admin access required.', 403)
        return null
      }
      return { thread, facilityId, viewer: adminViewer(req) }
    }
    if (portal === 'coach') {
      const coachUserId = Number(req.platformAuth.user.id)
      if (!await coachCanViewThread(thread, coachUserId)) {
        bad(res, 'Thread not found.', 404)
        return null
      }
      return { thread, facilityId, viewer: coachViewer(req) }
    }
    const memberId = memberViewer(req).memberId
    if (!await memberCanViewThread(threadId, memberId, thread)) {
      bad(res, 'Thread not found.', 404)
      return null
    }
    return { thread, facilityId, viewer: { memberId } }
  }

  function notificationPrefsHandler(portal, method) {
    return async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        const viewer = portal === 'member' ? memberViewer(req) : portal === 'coach' ? coachViewer(req) : adminViewer(req)
        if (method === 'GET') {
          ok(res, await getNotificationPreferences(pool, facilityId, viewer))
        } else {
          ok(res, await updateNotificationPreferences(pool, facilityId, viewer, req.body || {}))
        }
      } catch (error) {
        bad(res, error.message, 500)
      }
    }
  }

  const portals = ['coach', 'member', 'admin']

  for (const portal of portals) {
    app.get(`/api/${portal}/messages/tags`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        ok(res, await ensureDefaultTags(pool, facilityId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/calendar-inbox-rows`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        const memberId = portal === 'member' ? memberViewer(req).memberId : null
        if (portal === 'member' && memberId == null) {
          return bad(res, 'Member context required.', 403)
        }
        const limit = Math.min(num(req.query.limit) || 100, 200)
        ok(res, await listCalendarInboxRows(pool, facilityId, { memberId, limit }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.patch(`/api/${portal}/messages/:threadId/tags`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const slugs = Array.isArray(req.body?.tags) ? req.body.tags : req.body?.tag_slugs
        ok(res, await setThreadTags(pool, threadId, slugs || [], ctx.facilityId))
        broadcastMessageEvent({
          type: 'thread.updated',
          facilityId: ctx.facilityId,
          threadId,
          data: { tags: true },
        })
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/read`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const messageId = num(req.body?.message_id ?? req.body?.messageId)
        const read = await markThreadRead(pool, {
          threadId,
          userId: ctx.viewer.userId,
          memberId: ctx.viewer.memberId,
          messageId,
        })
        broadcastMessageEvent({
          type: 'read.updated',
          facilityId: ctx.facilityId,
          threadId,
          userId: ctx.viewer.userId,
          memberId: ctx.viewer.memberId,
          data: read,
        })
        ok(res, read)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/link`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const objectType = String(req.body?.object_type || req.body?.objectType || '')
        const objectId = num(req.body?.object_id ?? req.body?.objectId)
        const linkRole = String(req.body?.link_role || req.body?.linkRole || 'related')
        if (!objectType || objectId == null) return bad(res, 'object_type and object_id are required.')
        ok(res, await linkThreadToObject(pool, threadId, objectType, objectId, linkRole))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/pin/:messageId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const pin = await pinMessage(pool, threadId, messageId, ctx.viewer)
        if (!pin) return bad(res, 'Message not found.', 404)
        ok(res, pin)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/:threadId/pin-groups`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        ok(res, await loadThreadPinGroupsResponse(pool, threadId, ctx.viewer))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/pin-groups`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const rawIds = req.body?.message_ids ?? req.body?.messageIds
        const messageIds = Array.isArray(rawIds) ? rawIds.map((id) => num(id)).filter(Number.isFinite) : []
        if (messageIds.length === 0) return bad(res, 'message_ids is required.')
        const group = await createMessagePinGroup(pool, threadId, messageIds, ctx.viewer)
        if (!group) return bad(res, 'Message not found.', 404)
        ok(res, group)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.delete(`/api/${portal}/messages/:threadId/pin-groups/:groupId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const groupId = num(req.params.groupId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const result = await deleteMessagePinGroup(pool, groupId, ctx.viewer)
        if (result === 'forbidden') return bad(res, 'You can only unpin your own pin groups.', 403)
        if (!result) return bad(res, 'Pin group not found.', 404)
        ok(res, result)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/search`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        const viewer = portal === 'member' ? memberViewer(req) : portal === 'coach' ? coachViewer(req) : adminViewer(req)
        ok(res, await searchMessages(pool, facilityId, {
          q: req.query.q,
          tag: req.query.tag,
          objectType: req.query.object_type || req.query.objectType,
          objectId: num(req.query.object_id ?? req.query.objectId),
          hasFile: req.query.has_file === 'true' || req.query.hasFile === 'true',
          viewer,
          limit: num(req.query.limit),
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/files`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        const viewer = portal === 'member' ? memberViewer(req) : portal === 'coach' ? coachViewer(req) : adminViewer(req)
        ok(res, await listMessageFiles(pool, facilityId, {
          tag: req.query.tag,
          threadId: num(req.query.thread_id ?? req.query.threadId),
          limit: num(req.query.limit),
          viewer,
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/notification-preferences`, auth, notificationPrefsHandler(portal, 'GET'))
    app.patch(`/api/${portal}/messages/notification-preferences`, auth, notificationPrefsHandler(portal, 'PATCH'))
    app.get(`/api/${portal}/preferences/notifications`, auth, notificationPrefsHandler(portal, 'GET'))
    app.patch(`/api/${portal}/preferences/notifications`, auth, notificationPrefsHandler(portal, 'PATCH'))

    app.get(`/api/${portal}/messages/:threadId/polls`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        ok(res, await listThreadPolls(pool, threadId, ctx.viewer))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/polls`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const question = String(req.body?.question || '').trim()
        const options = Array.isArray(req.body?.options)
          ? req.body.options.map((option) => String(option || '').trim()).filter(Boolean)
          : []
        if (!question || options.length < 2) {
          return bad(res, 'question and at least two options are required.')
        }
        const created = await createCollaborationMessage(pool, threadId, ctx.viewer, portal, `Poll: ${question}`)
        const poll = await createMessagePoll(pool, created.id, {
          question,
          options,
          closesAt: req.body?.closes_at ?? req.body?.closesAt ?? null,
        })
        const message = await loadEnrichedMessageById(pool, created.id)
        emitMessageCreated({
          facilityId: ctx.facilityId,
          threadId,
          userId: ctx.viewer.userId ?? undefined,
          memberId: ctx.viewer.memberId ?? undefined,
          data: message,
        })
        ok(res, { message, poll: await loadMessagePoll(pool, created.id) ?? poll })
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.patch(`/api/${portal}/messages/:threadId/polls/:pollId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const pollId = num(req.params.pollId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const updated = await setMessagePollClosed(pool, pollId, req.body?.is_closed ?? req.body?.isClosed, threadId)
        if (!updated) return bad(res, 'Poll not found.', 404)
        ok(res, updated)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/messages/:threadId/signup-sheets`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        ok(res, await listThreadSignupSheets(pool, threadId, ctx.viewer))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/signup-sheets`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const title = String(req.body?.title || '').trim()
        const sheetType = String(req.body?.sheet_type ?? req.body?.sheetType ?? 'items')
        const items = Array.isArray(req.body?.items) ? req.body.items : []
        if (!title) return bad(res, 'title is required.')
        if (!['rsvp', 'items', 'support'].includes(sheetType)) return bad(res, 'Invalid signup list type.')
        if (sheetType !== 'rsvp' && items.length === 0) return bad(res, 'items are required.')
        const created = await createCollaborationMessage(pool, threadId, ctx.viewer, portal, `Signup list: ${title}`)
        const signup = await createMessageChecklist(pool, created.id, items, {
          title,
          sheetType,
          config: req.body?.config || {},
          closesAt: req.body?.closes_at ?? req.body?.closesAt ?? null,
        })
        const message = await loadEnrichedMessageById(pool, created.id)
        emitMessageCreated({
          facilityId: ctx.facilityId,
          threadId,
          userId: ctx.viewer.userId ?? undefined,
          memberId: ctx.viewer.memberId ?? undefined,
          data: message,
        })
        ok(res, { message, signup })
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.patch(`/api/${portal}/messages/:threadId/signup-sheets/:signupId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const signupId = num(req.params.signupId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const updated = await setMessageChecklistClosed(pool, signupId, req.body?.is_closed ?? req.body?.isClosed, threadId)
        if (!updated) return bad(res, 'Signup list not found.', 404)
        ok(res, updated)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/ack`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        ok(res, await acknowledgeMessage(pool, messageId, ctx.viewer))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.get(`/api/${portal}/events/:eventId/message-threads`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
          return bad(res, 'Admin access required.', 403)
        }
        const facilityId = req.platformAuth.user.facility_id
        const eventId = num(req.params.eventId)
        const threads = await getEventThreads(pool, eventId, facilityId)
        const viewer = portal === 'member' ? memberViewer(req) : portal === 'coach' ? coachViewer(req) : adminViewer(req)
        let enriched = await enrichThreadsWithTags(pool, threads)
        enriched = await enrichThreadsWithUnread(pool, enriched, viewer)
        ok(res, enriched)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    if (portal === 'member') {
      app.get('/api/member/events/:eventId/chat-status', auth, async (req, res) => {
        try {
          await ensureSchema()
          const facilityId = req.platformAuth.user.facility_id
          const eventId = num(req.params.eventId)
          const memberId = memberViewer(req).memberId
          if (memberId == null) return bad(res, 'Member context required.', 403)
          ok(res, await getEventChatStatus(pool, eventId, facilityId, memberId))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.post('/api/member/events/:eventId/message-threads/subscribe', auth, async (req, res) => {
        try {
          await ensureSchema()
          const facilityId = req.platformAuth.user.facility_id
          const eventId = num(req.params.eventId)
          const memberId = memberViewer(req).memberId
          if (memberId == null) return bad(res, 'Member context required.', 403)
          const result = await subscribeMemberToEventThreads(pool, eventId, facilityId, memberId)
          ok(res, result)
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.post('/api/member/events/:eventId/rsvp', auth, async (req, res) => {
        try {
          await ensureSchema()
          const eventId = num(req.params.eventId)
          const memberId = memberViewer(req).memberId
          if (memberId == null) return bad(res, 'Member context required.', 403)
          const status = String(req.body?.status || 'going')
          ok(res, await upsertEventRsvp(pool, eventId, memberId, status))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.get('/api/member/events/:eventId/rsvp', auth, async (req, res) => {
        try {
          await ensureSchema()
          const eventId = num(req.params.eventId)
          const memberId = memberViewer(req).memberId
          if (memberId == null) return bad(res, 'Member context required.', 403)
          ok(res, await getEventRsvp(pool, eventId, memberId))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.get('/api/member/schedule/upcoming', auth, async (req, res) => {
        try {
          await ensureSchema()
          const facilityId = req.platformAuth.user.facility_id
          const memberId = memberViewer(req).memberId
          if (memberId == null) return bad(res, 'Member context required.', 403)
          const limit = Math.min(num(req.query.limit) || 50, 100)
          ok(res, await listUpcomingCalendarItemsForMember(pool, memberId, facilityId, { limit }))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })
    }

    // Reactions
    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/reactions`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const emoji = String(req.body?.emoji || '').trim()
        if (!emoji) return bad(res, 'emoji is required.')
        await addMessageReaction(pool, messageId, emoji, ctx.viewer)
        ok(res, await loadMessageReactions(pool, messageId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.delete(`/api/${portal}/messages/:threadId/messages/:messageId/reactions/:emoji`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        await removeMessageReaction(pool, messageId, decodeURIComponent(req.params.emoji), ctx.viewer)
        ok(res, await loadMessageReactions(pool, messageId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    // Poll vote
    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/poll/vote`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const optionIndex = num(req.body?.option_index ?? req.body?.optionIndex)
        if (optionIndex == null) return bad(res, 'option_index is required.')
        const poll = await loadMessagePoll(pool, messageId)
        if (!poll) return bad(res, 'Poll not found.', 404)
        await voteMessagePoll(pool, poll.id, optionIndex, ctx.viewer)
        ok(res, await loadMessagePoll(pool, messageId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/poll`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const question = String(req.body?.question || '').trim()
        const options = Array.isArray(req.body?.options) ? req.body.options : []
        if (!question || options.length < 2) {
          return bad(res, 'question and at least two options are required.')
        }
        ok(res, await createMessagePoll(pool, messageId, {
          question,
          options,
          closesAt: req.body?.closes_at ?? req.body?.closesAt ?? null,
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/checklist`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const items = Array.isArray(req.body?.items) ? req.body.items : []
        if (items.length === 0) return bad(res, 'items are required.')
        ok(res, await createMessageChecklist(pool, messageId, items, {
          title: req.body?.title || 'Signup list',
          sheetType: req.body?.sheet_type ?? req.body?.sheetType ?? 'items',
          config: req.body?.config || {},
          closesAt: req.body?.closes_at ?? req.body?.closesAt ?? null,
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/signup/respond`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        await upsertSignupResponse(pool, messageId, req.body?.response || {}, ctx.viewer)
        ok(res, await loadMessageChecklist(pool, messageId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/messages/:messageId/checklist/claim`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const messageId = num(req.params.messageId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const itemIndex = num(req.body?.item_index ?? req.body?.itemIndex)
        if (itemIndex == null) return bad(res, 'item_index is required.')
        ok(res, await claimChecklistItem(pool, messageId, itemIndex, ctx.viewer))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    // FAQ
    app.get(`/api/${portal}/messages/:threadId/faq`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        ok(res, await listThreadFaq(pool, threadId))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.post(`/api/${portal}/messages/:threadId/faq`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'member') return bad(res, 'Members cannot add thread FAQs.', 403)
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const question = String(req.body?.question || '').trim()
        const answer = String(req.body?.answer || '').trim()
        if (!question || !answer) return bad(res, 'question and answer are required.')
        ok(res, await createThreadFaq(pool, threadId, {
          question,
          answer,
          sortOrder: num(req.body?.sort_order ?? req.body?.sortOrder),
          createdByUserId: ctx.viewer.userId,
          inMasterList: Boolean(req.body?.in_master_list ?? req.body?.inMasterList),
          masterSortOrder: num(req.body?.master_sort_order ?? req.body?.masterSortOrder),
          facilityId: ctx.facilityId,
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.patch(`/api/${portal}/messages/:threadId/faq/:faqId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'member') return bad(res, 'Members cannot edit thread FAQs.', 403)
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        const faqId = num(req.params.faqId)
        ok(res, await updateThreadFaq(pool, faqId, {
          question: req.body?.question,
          answer: req.body?.answer,
          sortOrder: num(req.body?.sort_order ?? req.body?.sortOrder),
          inMasterList: req.body?.in_master_list ?? req.body?.inMasterList,
          masterSortOrder: num(req.body?.master_sort_order ?? req.body?.masterSortOrder),
        }))
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    app.delete(`/api/${portal}/messages/:threadId/faq/:faqId`, auth, async (req, res) => {
      try {
        await ensureSchema()
        if (portal === 'member') return bad(res, 'Members cannot delete thread FAQs.', 403)
        const threadId = num(req.params.threadId)
        const ctx = await assertThreadAccess(req, res, threadId, portal)
        if (!ctx) return
        await deleteThreadFaq(pool, num(req.params.faqId))
        ok(res, { deleted: true })
      } catch (error) {
        bad(res, error.message, 500)
      }
    })

    if (portal === 'coach' || portal === 'admin') {
      app.get(`/api/${portal}/messages/faq-library`, auth, async (req, res) => {
        try {
          await ensureSchema()
          if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
            return bad(res, 'Admin access required.', 403)
          }
          const facilityId = req.platformAuth.user.facility_id
          ok(res, await listFacilityFaqLibrary(pool, facilityId))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.post(`/api/${portal}/messages/faq-library`, auth, async (req, res) => {
        try {
          await ensureSchema()
          if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
            return bad(res, 'Admin access required.', 403)
          }
          const facilityId = req.platformAuth.user.facility_id
          const question = String(req.body?.question || '').trim()
          const answer = String(req.body?.answer || '').trim()
          if (!question || !answer) return bad(res, 'question and answer are required.')
          const created = await createFacilityFaqEntry(pool, facilityId, {
            threadId: num(req.body?.thread_id ?? req.body?.threadId),
            question,
            answer,
            sortOrder: num(req.body?.sort_order ?? req.body?.sortOrder),
            createdByUserId: Number(req.platformAuth.user.id),
            inMasterList: Boolean(req.body?.in_master_list ?? req.body?.inMasterList),
            masterSortOrder: num(req.body?.master_sort_order ?? req.body?.masterSortOrder),
          })
          if (!created) return bad(res, 'Could not create FAQ entry.', 400)
          ok(res, created)
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.patch(`/api/${portal}/messages/faq-library/:faqId`, auth, async (req, res) => {
        try {
          await ensureSchema()
          if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
            return bad(res, 'Admin access required.', 403)
          }
          const faqId = num(req.params.faqId)
          const updated = await updateThreadFaq(pool, faqId, {
            question: req.body?.question,
            answer: req.body?.answer,
            sortOrder: num(req.body?.sort_order ?? req.body?.sortOrder),
            inMasterList: req.body?.in_master_list ?? req.body?.inMasterList,
            masterSortOrder: num(req.body?.master_sort_order ?? req.body?.masterSortOrder),
          })
          if (!updated) return bad(res, 'FAQ not found.', 404)
          ok(res, updated)
        } catch (error) {
          bad(res, error.message, 500)
        }
      })

      app.delete(`/api/${portal}/messages/faq-library/:faqId`, auth, async (req, res) => {
        try {
          await ensureSchema()
          if (portal === 'admin' && !isStaffAdmin(req.platformAuth)) {
            return bad(res, 'Admin access required.', 403)
          }
          const facilityId = req.platformAuth.user.facility_id
          const result = await deleteFacilityFaqEntry(pool, facilityId, num(req.params.faqId))
          if (result === 'forbidden') return bad(res, 'FAQ not found.', 404)
          if (!result) return bad(res, 'FAQ not found.', 404)
          ok(res, result)
        } catch (error) {
          bad(res, error.message, 500)
        }
      })
    }

    if (portal === 'member') {
      app.get('/api/member/faqs', auth, async (req, res) => {
        try {
          await ensureSchema()
          const facilityId = req.platformAuth.user.facility_id
          ok(res, await listMemberMasterFaqs(pool, facilityId))
        } catch (error) {
          bad(res, error.message, 500)
        }
      })
    }
  }

  // Admin-only event thread provisioning
  app.post('/api/admin/events/:eventId/message-threads', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const eventId = num(req.params.eventId)
      const adminUserId = Number(req.platformAuth.user.id)
      const result = await provisionEventThreads(pool, eventId, facilityId, {
        subject: req.body?.subject,
        infoJson: req.body?.info_json ?? req.body?.infoJson,
        participantMemberIds: req.body?.participant_member_ids ?? req.body?.participantMemberIds,
        participantUserIds: req.body?.participant_user_ids ?? req.body?.participantUserIds,
        adminUserId,
      })
      await logMessageAudit(pool, {
        facilityId,
        threadId: result.canonical.id,
        actor: { userId: adminUserId },
        action: 'event_threads_provisioned',
        detail: { event_id: eventId, discussion_id: result.discussion.id },
      })
      ok(res, result)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/admin/events/:eventId/calendar-items', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const eventId = num(req.params.eventId)
      ok(res, await listEventCalendarItems(pool, eventId, facilityId))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/admin/events/:eventId/calendar-items', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const eventId = num(req.params.eventId)
      ok(res, await createEventCalendarItem(pool, eventId, facilityId, req.body ?? {}))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.put('/api/admin/events/:eventId/calendar-items/:itemId', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const itemId = num(req.params.itemId)
      ok(res, await updateEventCalendarItem(pool, itemId, facilityId, req.body ?? {}))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.delete('/api/admin/events/:eventId/calendar-items/:itemId', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const itemId = num(req.params.itemId)
      await deleteEventCalendarItem(pool, itemId, facilityId)
      ok(res, { deleted: true })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/admin/events/:eventId/rsvps', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const eventId = num(req.params.eventId)
      ok(res, await listEventRsvps(pool, eventId))
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  // Admin notifications (staff user inbox)
  app.get('/api/admin/notifications', auth, async (req, res) => {
    try {
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      await ensureSchema()
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const unreadOnly = req.query.unreadOnly === 'true'
      const limit = Math.min(num(req.query.limit) || 50, 100)
      const params = [userId, facilityId]
      let where = `recipient_user_id = $1 AND facility_id = $2 AND ${HIGHLIGHT_NOTIFICATION_SQL}`
      if (unreadOnly) where += ` AND read_at IS NULL`
      params.push(limit)
      const result = await pool.query(
        `SELECT id, kind, title, body, payload, read_at, created_at
         FROM coaching.notification
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      )
      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS n FROM coaching.notification
         WHERE recipient_user_id = $1 AND facility_id = $2 AND read_at IS NULL
           AND ${HIGHLIGHT_NOTIFICATION_SQL}`,
        [userId, facilityId],
      )
      ok(res, { notifications: result.rows, unreadCount: countRes.rows[0]?.n ?? 0 })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.patch('/api/admin/notifications/:id/read', auth, async (req, res) => {
    try {
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      const id = num(req.params.id)
      const updated = await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE id = $1 AND recipient_user_id = $2 AND facility_id = $3 AND read_at IS NULL
         RETURNING *`,
        [id, userId, facilityId],
      )
      if (updated.rows.length === 0) return bad(res, 'Notification not found.', 404)
      broadcastMessageEvent({
        type: 'notification.created',
        facilityId,
        userId,
        data: { read: true, notification_id: id },
      })
      ok(res, updated.rows[0])
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/admin/notifications/mark-all-read', auth, async (req, res) => {
    try {
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const userId = Number(req.platformAuth.user.id)
      const facilityId = req.platformAuth.user.facility_id
      await pool.query(
        `UPDATE coaching.notification SET read_at = now()
         WHERE recipient_user_id = $1 AND facility_id = $2 AND read_at IS NULL
           AND ${HIGHLIGHT_NOTIFICATION_SQL}`,
        [userId, facilityId],
      )
      ok(res, { ok: true })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/admin/scheduling/forms/:formId/message-thread', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const formId = num(req.params.formId)
      const adminUserId = Number(req.platformAuth.user.id)
      const thread = await provisionSchedulingFormThread(pool, formId, facilityId, {
        subject: req.body?.subject,
        adminUserId,
      })
      ok(res, thread)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.post('/api/admin/scheduling/forms/:formId/system-message', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const formId = num(req.params.formId)
      const adminUserId = Number(req.platformAuth.user.id)
      const result = await postSchedulingSystemMessage(pool, {
        formId,
        facilityId,
        body: req.body?.body,
        isCritical: Boolean(req.body?.is_critical),
        senderUserId: adminUserId,
      })
      emitMessageCreatedImpl({
        facilityId,
        threadId: result.threadId,
        userId: adminUserId,
        data: { message_id: result.messageId },
      })
      ok(res, result)
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  for (const portal of ['coach', 'member', 'admin']) {
    app.get(`/api/${portal}/scheduling/forms/:formId/message-thread`, auth, async (req, res) => {
      try {
        await ensureSchema()
        const facilityId = req.platformAuth.user.facility_id
        const thread = await getSchedulingFormThread(pool, num(req.params.formId), facilityId)
        ok(res, thread)
      } catch (error) {
        bad(res, error.message, 500)
      }
    })
  }

  app.get('/api/admin/messages/retention-policy', auth, async (req, res) => {
    try {
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      ok(res, getMessageRetentionPolicy())
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  app.get('/api/admin/messages/audit-export', auth, async (req, res) => {
    try {
      await ensureSchema()
      if (!isStaffAdmin(req.platformAuth)) return bad(res, 'Admin access required.', 403)
      const facilityId = req.platformAuth.user.facility_id
      const rows = await exportMessageAudit(pool, facilityId, {
        since: req.query.since ? String(req.query.since) : null,
        until: req.query.until ? String(req.query.until) : null,
        limit: num(req.query.limit),
      })
      ok(res, { rows, count: rows.length, exported_at: new Date().toISOString() })
    } catch (error) {
      bad(res, error.message, 500)
    }
  })

  console.log('✅ Message platform routes registered')
}
