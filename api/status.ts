import { fal } from '@fal-ai/client'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

interface StatusRequestBody {
  requestId: string
  model: string
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

    // Configure fal client with API key
    fal.config({
      credentials: falKey,
    })

    // Get model ID
    const modelId = model === 'seedream-v4-edit' 
      ? 'fal-ai/bytedance/seedream/v4.5/edit'
      : model === 'nano-banana-pro'
      ? 'fal-ai/nano-banana-pro/edit'
      : 'fal-ai/flux-2/edit'

    // Check status
    const status = await fal.queue.status(modelId, {
      requestId,
      logs: true,
    })

    // If completed, get the result
    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(modelId, {
        requestId,
      })

      const imageUrl = result.data?.images?.[0]?.url

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
      status: status.status.toLowerCase(),
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


