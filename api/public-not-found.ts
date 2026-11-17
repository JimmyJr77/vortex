import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'

const html = readFileSync(join(process.cwd(), 'public', '404.html'))

export default function publicNotFound(request: IncomingMessage, response: ServerResponse) {
  response.statusCode = 404
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.end()
    return
  }

  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.setHeader('X-Robots-Tag', 'noindex, follow')
  response.end(request.method === 'HEAD' ? undefined : html)
}
