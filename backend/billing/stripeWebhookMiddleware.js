import express from 'express'

/** Raw body parser for POST /api/stripe/webhook — must run instead of express.json. */
export const stripeWebhookRawParser = express.raw({ type: 'application/json' })
