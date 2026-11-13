import Joi from 'joi'
import { applyRegistrationAttribution } from '../analytics/adminHandlers.js'
import { normalizePhoneNumber, PHONE_FORMAT_ERROR } from '../phoneNumbers.js'

const registrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().trim().max(255).email().required(),
  phone: Joi.string().trim().optional().allow('', null).custom((value, helpers) =>
    normalizePhoneNumber(value) ?? helpers.error('any.invalid'),
  ).messages({ 'any.invalid': PHONE_FORMAT_ERROR }),
  athleteAge: Joi.number().integer().min(5).max(18).optional().allow(null, ''),
  interests: Joi.alternatives().try(
    Joi.array().items(Joi.string().max(100)), // New multi-select interests (array of strings) - checked first
    Joi.string().max(500) // Legacy field for backward compatibility (single string)
  ).optional().allow(null),
  interest: Joi.string().max(100).optional().allow('', null), // Legacy single interest selection
  classTypes: Joi.array().items(Joi.string().valid(
    'Adult Classes',
    'Youth Classes',
    'Camps',
    'Homeschool Program',
    'Child Classes',
    'Gymnastics Summer Camp',
    'Summer Athletic Development Program',
  )).optional().allow(null),
  childAges: Joi.array().items(Joi.number().integer().min(1).max(18)).optional().allow(null),
  campers: Joi.array().items(Joi.object({
    firstName: Joi.string().min(1).max(50).optional().allow('', null),
    lastName: Joi.string().min(1).max(50).optional().allow('', null),
    dateOfBirth: Joi.string().isoDate().required(),
    gender: Joi.string().valid('male', 'female').optional().allow('', null),
  })).optional().allow(null),
  submitterRole: Joi.string().valid('Athlete', 'Parent/Guardian', 'Other').optional().allow('', null),
  inquirySource: Joi.string().max(500).optional().allow('', null),
  message: Joi.string().max(1000).optional().allow('', null),
  newsletter: Joi.boolean().optional().allow(null).default(false),
  visitorId: Joi.string().max(64).optional().allow('', null),
  sessionId: Joi.string().max(64).optional().allow('', null),
  landingPage: Joi.string().max(500).optional().allow('', null),
  hostname: Joi.string().max(255).optional().allow('', null),
  utmSource: Joi.string().max(100).optional().allow('', null),
  utmMedium: Joi.string().max(100).optional().allow('', null),
  utmCampaign: Joi.string().max(100).optional().allow('', null),
  utmContent: Joi.string().max(100).optional().allow('', null),
  utmTerm: Joi.string().max(100).optional().allow('', null),
})

export function registerPublicInquiryRoutes(app, pool, { applyAttribution = applyRegistrationAttribution } = {}) {
  app.post('/api/registrations', async (req, res) => {
    const { error, value } = registrationSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      })
    }

    const interests = Array.isArray(value.interests) ? value.interests : null
    const interestsText = interests ? interests.join(', ') : value.interests ?? null
    const campers = value.campers?.map(camper => ({
      ...(camper.firstName ? { firstName: camper.firstName } : {}),
      ...(camper.lastName ? { lastName: camper.lastName } : {}),
      ...(camper.gender ? { gender: camper.gender } : {}),
      dateOfBirth: camper.dateOfBirth.slice(0, 10),
    }))
    const isCampInquiry = value.classTypes?.some(type => type === 'Camps' || type === 'Gymnastics Summer Camp')
      || value.inquirySource === '/camp_interest'
    const submitterRole = value.submitterRole || (isCampInquiry ? 'Parent/Guardian' : null)

    try {
      const { rows: [inquiry] } = await pool.query(`
        INSERT INTO registrations
          (first_name, last_name, email, phone, athlete_age, interests, interests_array, interest,
           class_types, child_ages, campers, message, submitter_role, inquiry_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
        RETURNING id
      `, [
        value.firstName, value.lastName, value.email, value.phone || null, value.athleteAge || null,
        interestsText, interests, value.interest || null, value.classTypes?.length ? value.classTypes : null,
        value.childAges?.length ? value.childAges : null, campers?.length ? JSON.stringify(campers) : null,
        value.message || null, submitterRole, value.inquirySource || null,
      ])
      try {
        await applyAttribution(pool, inquiry.id, value)
      } catch (attrError) {
        console.warn('[registrations] attribution attach failed:', attrError.message)
      }
      return res.json({ success: true, message: 'Registration submitted successfully', id: inquiry.id })
    } catch (error) {
      console.error('[registrations] unable to save inquiry:', error.code)
      return res.status(500).json({ success: false, message: 'Unable to submit your inquiry. Please try again.' })
    }
  })
}
