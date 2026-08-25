const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

export const FLIP_FIT_DURATION_WEEKS = 12
export const FLIP_FIT_TRAINING_DATE_COUNT = 60
export const FLIP_FIT_END_DATE_OFFSET_DAYS = 81

export class FlipFitScheduleError extends Error {
  constructor(message, status = 400, code = 'invalid_flip_fit_schedule') {
    super(message)
    this.name = 'FlipFitScheduleError'
    this.status = status
    this.code = code
  }
}

function parseIsoDate(value) {
  const text = typeof value === 'string' ? value : ''
  const match = ISO_DATE_PATTERN.exec(text)
  if (!match) {
    throw new FlipFitScheduleError('Flip & Fit start date must use YYYY-MM-DD format.')
  }

  const date = new Date(`${text}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) {
    throw new FlipFitScheduleError('Flip & Fit start date must be a valid calendar date.')
  }
  return date
}

function requirePositiveInteger(value, fieldName) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`)
  }
  return number
}

function normalizeJsonObject(value, fieldName) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FlipFitScheduleError(`${fieldName} must be a JSON object.`)
  }
  try {
    const normalized = JSON.parse(JSON.stringify(value))
    if (normalized == null || typeof normalized !== 'object' || Array.isArray(normalized)) {
      throw new Error('not an object')
    }
    return normalized
  } catch {
    throw new FlipFitScheduleError(`${fieldName} must be JSON serializable.`)
  }
}

function normalizeExpectedUpdatedAt(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new FlipFitScheduleError('expectedUpdatedAt must be an ISO timestamp.')
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    throw new FlipFitScheduleError('expectedUpdatedAt must be an ISO timestamp.')
  }
  return parsed.toISOString()
}

function aliasedValue(raw, camelCaseKey, snakeCaseKey) {
  if (Object.prototype.hasOwnProperty.call(raw, camelCaseKey)) return raw[camelCaseKey]
  return raw[snakeCaseKey]
}

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function isoTimestamp(value) {
  if (value == null) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

export function calculateFlipFitEndDate(startDate) {
  const start = parseIsoDate(startDate)
  return new Date(start.valueOf() + FLIP_FIT_END_DATE_OFFSET_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

export function validateFlipFitScheduleInput(raw = {}) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FlipFitScheduleError('Flip & Fit schedule payload must be a JSON object.')
  }

  const startDate = aliasedValue(raw, 'startDate', 'start_date')
  const parsedStart = parseIsoDate(startDate)
  if (parsedStart.getUTCDay() !== 1) {
    throw new FlipFitScheduleError('Flip & Fit start date must be a Monday.')
  }

  const settingsValue = aliasedValue(raw, 'settings', 'settings_json')
  const overridesValue = aliasedValue(raw, 'sessionOverrides', 'session_overrides_json')
  const confirmValue = aliasedValue(raw, 'confirmRemap', 'confirm_remap')
  const expectedUpdatedAtValue = aliasedValue(raw, 'expectedUpdatedAt', 'expected_updated_at')
  if (confirmValue !== undefined && typeof confirmValue !== 'boolean') {
    throw new FlipFitScheduleError('confirmRemap must be a boolean.')
  }

  return {
    startDate,
    endDate: calculateFlipFitEndDate(startDate),
    settings: settingsValue === undefined ? undefined : normalizeJsonObject(settingsValue, 'settings'),
    sessionOverrides: overridesValue === undefined
      ? undefined
      : normalizeJsonObject(overridesValue, 'sessionOverrides'),
    confirmRemap: confirmValue === true,
    expectedUpdatedAt: normalizeExpectedUpdatedAt(expectedUpdatedAtValue),
  }
}

function mapScheduleRow(row) {
  if (!row) return null
  return {
    facilityId: Number(row.facility_id),
    startDate: isoDate(row.start_date),
    endDate: isoDate(row.end_date),
    durationWeeks: FLIP_FIT_DURATION_WEEKS,
    trainingDateCount: FLIP_FIT_TRAINING_DATE_COUNT,
    settings: row.settings_json ?? {},
    sessionOverrides: row.session_overrides_json ?? {},
    createdBy: row.created_by == null ? null : Number(row.created_by),
    updatedBy: row.updated_by == null ? null : Number(row.updated_by),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export async function loadFlipFitSchedule(pool, facilityId) {
  const scopedFacilityId = requirePositiveInteger(facilityId, 'facilityId')
  const result = await pool.query(
    `SELECT facility_id, start_date, end_date, settings_json, session_overrides_json,
            created_by, updated_by, created_at, updated_at
     FROM coaching.flip_fit_schedule
     WHERE facility_id = $1`,
    [scopedFacilityId],
  )
  return mapScheduleRow(result.rows[0])
}

export async function saveFlipFitSchedule(pool, facilityId, actorUserId, raw = {}) {
  const scopedFacilityId = requirePositiveInteger(facilityId, 'facilityId')
  const scopedActorUserId = requirePositiveInteger(actorUserId, 'actorUserId')
  const schedule = validateFlipFitScheduleInput(raw)
  const settingsJson = schedule.settings === undefined ? null : JSON.stringify(schedule.settings)
  const overridesJson = schedule.sessionOverrides === undefined
    ? null
    : JSON.stringify(schedule.sessionOverrides)

  const result = await pool.query(
    `INSERT INTO coaching.flip_fit_schedule AS existing (
       facility_id, start_date, end_date, settings_json, session_overrides_json,
       created_by, updated_by
     ) VALUES (
       $1, $2::date, $3::date, COALESCE($4::jsonb, '{}'::jsonb),
       COALESCE($5::jsonb, '{}'::jsonb), $6, $6
     )
     ON CONFLICT (facility_id) DO UPDATE SET
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       settings_json = COALESCE($4::jsonb, existing.settings_json),
       session_overrides_json = COALESCE($5::jsonb, existing.session_overrides_json),
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     WHERE (existing.start_date = EXCLUDED.start_date OR $7::boolean)
       AND ($8::timestamptz IS NULL OR existing.updated_at = $8::timestamptz)
     RETURNING facility_id, start_date, end_date, settings_json, session_overrides_json,
               created_by, updated_by, created_at, updated_at`,
    [
      scopedFacilityId,
      schedule.startDate,
      schedule.endDate,
      settingsJson,
      overridesJson,
      scopedActorUserId,
      schedule.confirmRemap,
      schedule.expectedUpdatedAt ?? null,
    ],
  )

  if (result.rows.length === 0) {
    const currentResult = await pool.query(
      `SELECT start_date, updated_at
       FROM coaching.flip_fit_schedule
       WHERE facility_id = $1`,
      [scopedFacilityId],
    )
    const current = currentResult.rows[0]
    if (
      current
      && schedule.expectedUpdatedAt
      && isoTimestamp(current.updated_at) !== schedule.expectedUpdatedAt
    ) {
      throw new FlipFitScheduleError(
        'The Flip & Fit schedule changed after it was loaded. Reload before saving so another coach’s edits are not overwritten.',
        409,
        'flip_fit_schedule_conflict',
      )
    }
    throw new FlipFitScheduleError(
      'Changing the Flip & Fit start date requires confirmRemap=true.',
      409,
      'flip_fit_remap_confirmation_required',
    )
  }
  return mapScheduleRow(result.rows[0])
}
