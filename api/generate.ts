export const config = {
  runtime: 'edge',
}

interface RequestBody {
  image: string
  dream: string
}

interface FalResponse {
  images?: Array<{ url: string }>
  prompt?: string
}

function craftPrompt(dream: string): string {
  return `Realistic photograph of this EXACT SAME PERSON actually ${dream}.
CRITICAL IDENTITY: Must be the SAME INDIVIDUAL - preserve exact face structure, nose, eyes, skin tone, hair. Identity-preserving edit.
SHOT TYPE: Medium close-up shot (from waist or chest up). NOT a floating head, NOT a portrait overlay. The person has a FULL BODY naturally positioned in the real scene.
REALISM: This must look like a real candid photograph taken in the moment - the person is physically THERE, doing the activity, interacting with the environment.
The person should be wearing appropriate clothing/gear for the activity "${dream}".
Natural pose and body language as if actually performing the activity.
Environment should wrap around the person naturally with correct perspective, lighting, and scale.
Expression showing genuine emotion (joy, wonder, excitement) but SAME PERSON's face.
Photorealistic, natural lighting matching the scene, sharp focus, 8k quality. Like a National Geographic or sports photography shot.`
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

    // Use synchronous fal.ai endpoint (fal.run instead of queue.fal.run)
    // This blocks until the result is ready - simpler than polling
    const response = await fetch('https://fal.run/fal-ai/flux-2/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_urls: [image],
        guidance_scale: 2.5,
        num_inference_steps: 28,
        image_size: 'portrait_4_3',
        num_images: 1,
        acceleration: 'regular',
        enable_safety_checker: true,
        output_format: 'png',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fal.ai error: ${errorText}`)
    }

    const result: FalResponse = await response.json()
    const imageUrl = result.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image in response')
    }

    return new Response(JSON.stringify({ imageUrl, prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
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
