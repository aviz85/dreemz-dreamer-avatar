export const config = {
  runtime: 'edge',
}

interface RequestBody {
  image: string
  dream: string
}

interface FalQueueResponse {
  request_id: string
  status: string
}

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  response_url?: string
}

interface FalResultResponse {
  images?: Array<{ url: string }>
}

function craftPrompt(dream: string): string {
  return `Cinematic portrait of this EXACT SAME PERSON ${dream}.
CRITICAL: The person in the output MUST be the SAME INDIVIDUAL as in the input image - same face structure, same nose, same eyes, same skin tone, same hair color and style. This is an identity-preserving edit.
Show the person from chest/shoulders up, naturally integrated into the dream scene.
The face should be clearly recognizable and well-lit, taking about 25-30% of the frame.
Create a balanced composition where both the person AND the "${dream}" environment are equally important.
The person should appear to be genuinely IN the scene, not just pasted on top.
The expression can be different (showing wonder, joy, achievement) but the IDENTITY must remain 100% consistent - it must be unmistakably the same human being.
Preserve: exact facial bone structure, eye shape and color, nose shape, lip shape, skin complexion, hair texture and color, any distinctive features like moles or freckles.
Dramatic cinematic lighting, photorealistic, epic movie poster quality. 8k, sharp details.`
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    const body: RequestBody = await request.json()
    const { image, dream } = body

    if (!image || !dream) {
      return new Response(
        JSON.stringify({ error: 'Image and dream are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const prompt = craftPrompt(dream)

    // Submit the request to fal.ai queue
    const submitResponse = await fetch('https://queue.fal.run/fal-ai/flux-2/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_urls: [image],
        guidance_scale: 3.5,
        num_inference_steps: 28,
        image_size: 'portrait_4_3',
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'png',
      }),
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      throw new Error(`Failed to submit request: ${errorText}`)
    }

    const queueData: FalQueueResponse = await submitResponse.json()
    const requestId = queueData.request_id

    // Poll for completion
    let attempts = 0
    const maxAttempts = 120 // 2 minutes max
    
    while (attempts < maxAttempts) {
      await sleep(1000)
      
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/flux-2/edit/requests/${requestId}/status`,
        {
          headers: { 'Authorization': `Key ${falKey}` },
        }
      )

      if (!statusResponse.ok) {
        throw new Error('Failed to check status')
      }

      const statusData: FalStatusResponse = await statusResponse.json()

      if (statusData.status === 'COMPLETED') {
        // Get the result
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/flux-2/edit/requests/${requestId}`,
          {
            headers: { 'Authorization': `Key ${falKey}` },
          }
        )

        if (!resultResponse.ok) {
          throw new Error('Failed to get result')
        }

        const resultData: FalResultResponse = await resultResponse.json()
        const imageUrl = resultData.images?.[0]?.url

        if (!imageUrl) {
          throw new Error('No image in response')
        }

        return new Response(JSON.stringify({ imageUrl, prompt }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (statusData.status === 'FAILED') {
        throw new Error('Image generation failed')
      }

      attempts++
    }

    throw new Error('Request timed out')
  } catch (error) {
    console.error('Generation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Generation failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}
