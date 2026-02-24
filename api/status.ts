export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

interface StatusRequestBody {
  requestId: string
  model: string
  statusUrl?: string
  responseUrl?: string
}

export default async function handler(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY

  if (!falKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const body: StatusRequestBody = await request.json()
    const { requestId, statusUrl, responseUrl } = body

    if (!requestId || !statusUrl || !responseUrl) {
      return new Response(
        JSON.stringify({ error: 'requestId, statusUrl, and responseUrl are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Check status using the URL returned by fal.ai
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falKey}`,
      },
    })

    if (!statusResponse.ok) {
      const errText = await statusResponse.text()
      console.error('fal.ai status error:', statusResponse.status, errText)
      throw new Error(`Status check failed: ${statusResponse.status}`)
    }

    const statusData = await statusResponse.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result using the response URL
      const resultResponse = await fetch(responseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${falKey}`,
        },
      })

      if (!resultResponse.ok) {
        throw new Error('Failed to fetch result')
      }

      const resultData = await resultResponse.json()
      const imageUrl = resultData.images?.[0]?.url

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'No image in response' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      return new Response(JSON.stringify({
        status: 'completed',
        imageUrl,
        requestId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({
      status: statusData.status.toLowerCase(),
      requestId,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error) {
    console.error('Status check error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Status check failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}
