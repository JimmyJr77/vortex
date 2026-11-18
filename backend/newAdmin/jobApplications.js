import express from 'express'
import rateLimit from 'express-rate-limit'
import Joi from 'joi'
import { isValidCalendarDate } from '../members/dateOnlyAge.js'
import { normalizePhoneNumber, PHONE_FORMAT_ERROR } from '../phoneNumbers.js'
import { id, inputError, pagination, pageResult } from './common.js'

const roles = ['gymnastics', 'youth_fitness', 'both']
const ageGroups = ['under_5', '5_7', '8_11', '12_15', '16_17']
const certificationKeys = [
  'cpr_aed', 'first_aid', 'safesport', 'usag_u100', 'usag_u101', 'usag_coaching',
  'personal_trainer', 'group_fitness', 'youth_fitness', 'cscs',
]
const statuses = ['new', 'in_review', 'interview', 'closed']
const disciplines = {
  plyometrics: 'Plyometrics',
  strengthTraining: 'Strength training',
  speedAgility: 'Speed & agility',
  hiit: 'HIIT',
  tumbling: 'Tumbling',
  trampoline: 'Trampoline',
  womensArtisticGymnastics: 'Women’s artistic gymnastics',
  mensArtisticGymnastics: 'Men’s artistic gymnastics',
  acro: 'Acro',
  dance: 'Dance',
}

function text(label, max) {
  return Joi.string().trim().max(max).pattern(/\x00/, { invert: true }).label(label)
}

function optionalText(label, max) {
  return text(label, max).empty('').allow(null).default(null)
}

function selections(keys, label) {
  return Joi.array().items(Joi.string().valid(...keys)).unique().max(keys.length).label(label)
}

const submissionSchema = Joi.object({
  requestId: Joi.string().guid({ version: 'uuidv4' }).required().label('Application reference'),
  firstName: text('First name', 100).required(),
  lastName: text('Last name', 100).required(),
  email: text('Email', 254).email().required(),
  phone: text('Phone', 30).custom((value, helpers) => normalizePhoneNumber(value) ?? helpers.error('any.invalid'))
    .messages({ 'any.invalid': PHONE_FORMAT_ERROR }).required(),
  role: Joi.string().valid(...roles).required().label('Coaching role'),
  availability: text('Availability', 1000).required(),
  coachedChildren: Joi.boolean().strict().required().label('Experience training children'),
  ageGroups: selections(ageGroups, 'Age groups coached').when('coachedChildren', {
    is: true,
    then: Joi.array().min(1).required(),
    otherwise: Joi.array().length(0).default([]),
  }),
  youthCoachingDetails: text('Youth coaching experience', 2000).when('coachedChildren', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.valid(null).empty('').default(null),
  }),
  ratings: Joi.object(Object.fromEntries(Object.entries(disciplines).map(([key, label]) => [
    key, Joi.number().integer().min(1).max(5).strict().required().label(label),
  ]))).required().label('Experience ratings'),
  employmentType: Joi.string().valid('part_time', 'full_time', 'either').empty('').allow(null).default(null).label('Employment preference'),
  earliestStartDate: optionalText('Earliest start date', 10).pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((value, helpers) => isValidCalendarDate(value) ? value : helpers.error('any.invalid'))
    .messages({ 'any.invalid': 'Enter a valid earliest start date.' }),
  workExperience: optionalText('Work experience', 3000),
  certificationKeys: selections(certificationKeys, 'Certifications').default([]),
  certifications: optionalText('Other certifications', 1500),
  resumeUrl: optionalText('Résumé link', 2048).uri({ scheme: ['http', 'https'] }).custom((value, helpers) => {
    const url = new URL(value)
    return !url.hostname || url.username || url.password || url.href.length > 2048
      ? helpers.error('any.invalid')
      : url.href
  }).messages({ 'any.invalid': 'Enter a valid http or https résumé link without embedded credentials.' }),
  additionalInfo: optionalText('Additional information', 1500),
}).required()

export function jobApplicationInput(body) {
  const { error, value } = submissionSchema.validate(body)
  if (error) throw inputError(error.details[0].message)
  return {
    ...value,
    ageGroups: ageGroups.filter(key => value.ageGroups.includes(key)),
    certificationKeys: certificationKeys.filter(key => value.certificationKeys.includes(key)),
  }
}

export async function submitJobApplication(db, body) {
  const { requestId, firstName, lastName, email, phone, role, ...details } = jobApplicationInput(body)
  const { rows: [facility] } = await db.query(`SELECT facility_id FROM new_admin_public_lead_facility WHERE singleton = TRUE`)
  if (!facility) throw inputError('Job applications are temporarily unavailable. Please try again later.', 503)

  const values = [facility.facility_id, requestId, firstName, lastName, email, phone, role, JSON.stringify(details)]
  const { rows: [application] } = await db.query(`INSERT INTO job_application
    (facility_id, request_id, first_name, last_name, email, phone, role, details)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT (facility_id, request_id) DO NOTHING RETURNING id`, values)
  if (application) return { id: Number(application.id) }

  // An exact replay can safely return the original receipt without updating it.
  const { rows: [prior] } = await db.query(`SELECT id FROM job_application
    WHERE facility_id=$1 AND request_id=$2 AND first_name=$3 AND last_name=$4 AND email=$5
      AND phone=$6 AND role=$7 AND details=$8::jsonb`, values)
  if (!prior) throw inputError('This application was already submitted with different information.', 409)
  return { id: Number(prior.id) }
}

const summaryColumns = 'id, created_at, first_name, last_name, email, phone, role, status'

function applicationSummary(row) {
  return {
    id: Number(row.id), createdAt: row.created_at, firstName: row.first_name,
    lastName: row.last_name, email: row.email, phone: row.phone, role: row.role, status: row.status,
  }
}

function applicationDetail(row) {
  if (!row) throw inputError('Job application not found.', 404)
  return { ...row.details, ...applicationSummary(row) }
}

export async function listJobApplications(db, facilityId, query) {
  const facility = id(facilityId, 'facility')
  const paging = pagination(query)
  const [applications, count] = await Promise.all([
    db.query(`SELECT ${summaryColumns} FROM job_application WHERE facility_id=$1
      ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, [facility, paging.pageSize, paging.offset]),
    db.query('SELECT COUNT(*) AS total FROM job_application WHERE facility_id=$1', [facility]),
  ])
  return pageResult(applications.rows.map(applicationSummary), count.rows[0].total, paging)
}

export async function getJobApplication(db, facilityId, applicationId) {
  const { rows: [application] } = await db.query(`SELECT ${summaryColumns}, details FROM job_application
    WHERE facility_id=$1 AND id=$2`, [id(facilityId, 'facility'), id(applicationId, 'application')])
  return applicationDetail(application)
}

export async function updateJobApplication(db, facilityId, applicationId, body) {
  const { error, value } = Joi.object({ status: Joi.string().valid(...statuses).required().label('Status') }).required().validate(body)
  if (error) throw inputError(error.details[0].message)
  const { rows: [application] } = await db.query(`UPDATE job_application SET status=$3 WHERE facility_id=$1 AND id=$2
    RETURNING ${summaryColumns}, details`, [id(facilityId, 'facility'), id(applicationId, 'application'), value.status])
  return applicationDetail(application)
}

export function setApplicationCacheControl(_req, res, next) {
  res.setHeader('Cache-Control', 'private, no-store')
  next()
}

export function registerPublicJobApplicationRoutes(app, db) {
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many application attempts. Please try again later.' },
  })
  const parse = express.json({ limit: '64kb' })
  app.post('/api/public/job-applications', setApplicationCacheControl, limit, (req, res, next) => {
    parse(req, res, error => {
      if (!error) return next()
      if (error.status === 413) return res.status(413).json({ success: false, message: 'The application is too long.' })
      return res.status(400).json({ success: false, message: 'Unable to read the application.' })
    })
  }, async (req, res) => {
    try {
      const data = await submitJobApplication(db, req.body)
      return res.json({ success: true, data })
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })
      console.error('[job-applications] Unable to save application:', error.code || error.name)
      return res.status(500).json({ success: false, message: 'Unable to submit your application. Please try again.' })
    }
  })
}
