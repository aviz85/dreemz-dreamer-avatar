import { fal } from '@fal-ai/client'

export const config = {
  runtime: 'edge',
}

interface RequestBody {
  image: string
  dream: string
}

function craftPrompt(dream: string): string {
  return `Close-up portrait photo of this person ${dream}. 
IMPORTANT: Keep the face large and clearly visible, taking up at least 40% of the frame.
This is a headshot/portrait composition - the person's face and upper body should be the main focus.
Add dreamlike background elements and environment that suggest "${dream}" while keeping the person as the dominant subject.
Maintain exact facial features, skin tone, and likeness of the original person.
Cinematic lighting on the face, dramatic atmosphere, photorealistic, magazine cover quality portrait.
The expression should show joy, wonder, and fulfillment of achieving this dream.
8k resolution, sharp focus on face, professional portrait photography.`
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
