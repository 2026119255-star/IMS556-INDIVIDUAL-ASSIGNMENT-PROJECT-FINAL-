/**
 * EduTrack - Ed live search (a small Cloudflare Worker).
 *
 * Ed sends a question here. This Worker asks an AI model, which can search
 * the web, and returns the answer. The API key lives only on the server, so
 * it is never visible to students.
 *
 * Settings (see README.md):
 *   ANTHROPIC_API_KEY  secret: your Anthropic API key
 *   ALLOWED_ORIGIN     variable: your website address, e.g. https://username.github.io
 *   ED_MODEL           optional variable: the model name to use
 */

const MAX_QUESTION = 500;
const MAX_CONTEXT = 500;
const DEFAULT_MODEL = 'claude-haiku-5-5';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
});

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
});

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '';
    const requestOrigin = request.headers.get('Origin') || '';

    // Browsers ask first with OPTIONS; answer so the real request is allowed
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Use POST' }, 405, allowedOrigin);
    }

    // Only the EduTrack website may use this service
    if (!allowedOrigin || requestOrigin !== allowedOrigin) {
      return json({ error: 'Origin not allowed' }, 403, allowedOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request' }, 400, allowedOrigin);
    }

    const question = String(body.question || '').trim().slice(0, MAX_QUESTION);
    const context = String(body.context || '').trim().slice(0, MAX_CONTEXT);
    if (!question) {
      return json({ error: 'Empty question' }, 400, allowedOrigin);
    }

    const system = [
      'You are Ed, a friendly study assistant inside the EduTrack student portal.',
      'Answer in plain English, in at most 120 words.',
      'Use web search for anything current, recent or time-sensitive. Say where the information came from and roughly when it was published.',
      'If you cannot confirm something, say so instead of guessing.',
      'Do not ask for or repeat personal details.',
      context
    ].filter(Boolean).join(' ');

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.ED_MODEL || DEFAULT_MODEL,
        max_tokens: 600,
        system,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!upstream.ok) {
      return json({ error: 'Search service unavailable' }, 502, allowedOrigin);
    }

    const data = await upstream.json();
    const answer = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return json({ answer: answer || 'I could not find a clear answer.' }, 200, allowedOrigin);
  }
};
