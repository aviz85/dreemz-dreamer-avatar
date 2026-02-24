export const config = {
  runtime: 'edge',
}

export default function handler(_request: Request): Response {
  return new Response(JSON.stringify({ ok: true, time: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
