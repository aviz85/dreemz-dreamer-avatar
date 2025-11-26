import { fal } from '@fal-ai/client'

export const config = {
  runtime: 'edge',
}

interface RequestBody {
  image: string
  dream: string
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY

  if (!falKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  fal.config({
    credentials: falKey,
  })

  try {
    const body: RequestBody = await request.json()
    const { image, dream } = body

    if (!image || !dream) {
      return new Response(
        JSON.stringify({ error: 'Image and dream are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const prompt = craftPrompt(dream)

    const result = await fal.subscribe('fal-ai/flux-2/edit', {
      input: {
        prompt,
        image_urls: [image],
        guidance_scale: 3.5,
        num_inference_steps: 28,
        image_size: 'portrait_4_3',
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'png',
      },
      logs: false,
    })

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate image' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ imageUrl, prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Generation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Generation failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
