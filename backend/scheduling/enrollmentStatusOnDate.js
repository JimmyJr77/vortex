/** Staff actions reserve attendance on their effective date, including actions
 * already applied after a historical roster date. Arguments are trusted SQL. */
export function enrollmentStatusOnDateSql(signupAlias,dateSql) {
  return `COALESCE(
    (SELECT action.requested_status FROM enrollment_action action
      WHERE action.signup_id=${signupAlias}.id AND action.status IN ('pending','applied') AND action.effective_date<=${dateSql}
      ORDER BY action.effective_date DESC,action.id DESC LIMIT 1),
    (SELECT action.previous_status FROM enrollment_action action
      WHERE action.signup_id=${signupAlias}.id AND action.status='applied' AND action.effective_date>${dateSql}
      ORDER BY action.effective_date,action.id LIMIT 1),${signupAlias}.status)`
}
