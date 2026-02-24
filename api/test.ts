export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
}

export default async function handler(request: Request): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  
  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY
  
  const results: Record<string, string> = {
    FAL_KEY_exists: falKey ? `yes (${falKey.substring(0, 8)}...)` : 'NO',
    OPENROUTER_exists: process.env.OPENROUTER_API_KEY ? 'yes' : 'NO',
    timestamp: new Date().toISOString(),
  }

  // Test basic fetch to fal.ai
  try {
    const start = Date.now()
    const res = await fetch('https://queue.fal.run', { method: 'GET' })
    results.fal_fetch = `${res.status} in ${Date.now() - start}ms`
  } catch (err: any) {
    results.fal_fetch = `ERROR: ${err.message}`
  }

  return new Response(JSON.stringify(results, null, 2), { status: 200, headers })
}
