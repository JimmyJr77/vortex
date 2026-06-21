/**
 * LLM integration via Vercel AI SDK.
 * Falls back to null when no API key — callers use rule-based text.
 */
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY)
}

function resolveModel() {
  const modelId = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  return openai(modelId)
}

/**
 * @param {{ system?: string; prompt: string; maxTokens?: number }} opts
 * @returns {Promise<string | null>}
 */
export async function llmGenerateText({ system, prompt, maxTokens = 600 }) {
  if (!isLlmConfigured()) return null
  try {
    const { text } = await generateText({
      model: resolveModel(),
      system,
      prompt,
      maxOutputTokens: maxTokens,
    })
    return text?.trim() || null
  } catch (err) {
    console.warn('[ai] generateText failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Parent-friendly progress narrative grounded in athlete metrics.
 */
export async function llmProgressNarrative({
  athleteName,
  tenetCoverage,
  assessmentTrends,
}) {
  const context = JSON.stringify({ tenetCoverage, assessmentTrends }, null, 2)
  return llmGenerateText({
    system:
      'You write warm, parent-friendly progress summaries for a youth athletics facility. ' +
      'Use plain language, 3-5 short sentences, no bullet lists. Be encouraging and specific when data is provided. ' +
      'Do not invent metrics not present in the JSON context.',
    prompt: `Athlete name: ${athleteName}\n\nTraining context JSON:\n${context}\n\nWrite the progress summary.`,
    maxTokens: 400,
  })
}
