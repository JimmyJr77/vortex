UPDATE payroll_onboarding_task
SET required=false,
    status='NOT_APPLICABLE',
    completed_at=COALESCE(completed_at,clock_timestamp()),
    updated_at=clock_timestamp()
WHERE task_key='AVAILABILITY'
  AND (required OR status<>'NOT_APPLICABLE');
