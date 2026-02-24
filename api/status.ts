export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const FAL_BASE = 'https://queue.fal.run'

interface StatusRequestBody {
  requestId: string
  model: string
}

function getModelId(model: string): string {
  switch (model) {
    case 'nano-banana-pro':
      return 'fal-ai/nano-banana-pro/edit'
    case 'seedream-v45-edit':
      return 'fal-ai/bytedance/seedream/v4.5/edit'
    case 'flux-2-edit':
    default:
      return 'fal-ai/flux-2/edit'
  }
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
    const { requestId, model } = body

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const modelId = getModelId(model)

    // Check status via fal.ai REST API
    const statusResponse = await fetch(
      `${FAL_BASE}/${modelId}/requests/${requestId}/status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Key ${falKey}`,
        },
      }
    )

    if (!statusResponse.ok) {
      const errText = await statusResponse.text()
      console.error('fal.ai status error:', statusResponse.status, errText)
      throw new Error(`Status check failed: ${statusResponse.status}`)
    }

    const statusData = await statusResponse.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResponse = await fetch(
        `${FAL_BASE}/${modelId}/requests/${requestId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Key ${falKey}`,
          },
        }
      )

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

    // Return current status
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
