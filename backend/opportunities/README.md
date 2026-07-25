# Opportunity research

The admin **Opportunities** page stores its records in `admin_opportunities`.
Admins with `analytics.view` can add and update records in the UI.

Codex can refresh the starter catalog by updating `seedOpportunities` in
`opportunityData.js`. Seeds only run when the table is empty, so they never
overwrite admin edits. For an existing database, use the authenticated admin API
(`POST /api/admin/opportunities` and `PUT /api/admin/opportunities/:id`) or the UI.

AI support is server-only and optional:

- `OPENAI_API_KEY` enables ChatGPT.
- `OPENAI_MODEL` selects the low-cost model.
- `OPPORTUNITY_AI_HOURLY_LIMIT` defaults to 20.

The assistant only sees up to 30 opportunity records. Prompts are capped at 800
characters, context at 18,000 characters, and output at 350 tokens. It cannot
browse, send outreach, or mutate records.
