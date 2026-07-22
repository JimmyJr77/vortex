#!/usr/bin/env node

const apiBase = String(process.env.VORTEX_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')

async function get(path) {
  const response = await fetch(`${apiBase}${path}`)
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success === false) {
    throw new Error(`${path} failed (${response.status}): ${body?.message || 'invalid response'}`)
  }
  return body?.data ?? body
}

const classesPayload = await get('/api/public/classes-offered')
const programs = Array.isArray(classesPayload) ? classesPayload : classesPayload?.programs
const forms = await get('/api/scheduling/forms')

if (!Array.isArray(programs) || !Array.isArray(forms)) {
  throw new Error('Catalog endpoints did not return arrays')
}

const classes = programs.flatMap((program) =>
  (program.classes || []).map((classItem) => ({
    ...classItem,
    parentProgram: program.displayName || program.name,
    primarySport: program.primarySportName || program.primarySport || null,
  })),
)
const linkedClasses = classes.filter((classItem) => classItem.formId != null)
const classFormIds = new Set(linkedClasses.map((classItem) => Number(classItem.formId)))
const publicFormIds = new Set(forms.map((form) => Number(form.id)))

const failures = []
for (const classItem of linkedClasses) {
  if (!classItem.signupUrl) failures.push(`${classItem.displayName}: missing Sign Up URL`)
  if (!publicFormIds.has(Number(classItem.formId))) {
    failures.push(`${classItem.displayName}: form ${classItem.formId} missing from public forms`)
  }
}
for (const form of forms) {
  if (!classFormIds.has(Number(form.id))) {
    failures.push(`${form.title}: public form ${form.id} missing from Classes Offered`)
  }
}

for (const classItem of linkedClasses) {
  const catalog = await get(`/api/signup/catalog/classes/${classItem.id}/offerings`)
  if (Number(catalog?.formId) !== Number(classItem.formId)) {
    failures.push(`${classItem.displayName}: member catalog form does not match Classes Offered`)
  }
  if (!Array.isArray(catalog?.scheduleOptions) || catalog.scheduleOptions.length === 0) {
    failures.push(`${classItem.displayName}: no active schedule options`)
  }
  if (!catalog?.priceLabel) failures.push(`${classItem.displayName}: no effective Class Master price`)
}

const gymnastics = programs.filter(
  (program) => String(program.primarySportName || program.primarySport).toLowerCase() === 'gymnastics',
)
const athleticism = programs.filter(
  (program) =>
    String(program.primarySportName || program.primarySport).toLowerCase() ===
    'athleticism accelerator',
)
if (gymnastics.length === 0) failures.push('no Gymnastics programs found')
if (athleticism.length === 0) failures.push('no Athleticism Accelerator programs found')

if (failures.length > 0) {
  console.error(`Enrollment catalog verification failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    `Enrollment catalog verified: ${programs.length} programs, ${classes.length} classes, ` +
      `${linkedClasses.length} signup forms (${gymnastics.length} Gymnastics programs; ` +
      `${athleticism.length} Athleticism Accelerator programs).`,
  )
}
