function seconds(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.0+)?)?$/.exec(String(value ?? ''))
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0) : null
}

/** A private evaluation reserves one athlete for exactly half an hour. */
export function isPrivateAssessmentTime({ startTime, endTime, maxParticipants }) {
  const start = seconds(startTime), end = seconds(endTime)
  return start != null && end != null && end - start === 30 * 60 && Number(maxParticipants) === 1
}
