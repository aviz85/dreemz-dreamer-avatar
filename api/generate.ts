import { fal } from '@fal-ai/client'

export const config = {
  runtime: 'edge',
}

interface RequestBody {
  image: string
  dream: string
}

function craftPrompt(dream: string): string {
  return `Transform this portrait into an epic, cinematic visualization of their dream: "${dream}". 
The person should be shown actively living and achieving this dream in a breathtaking, photorealistic scene. 
Make it inspirational, powerful, and emotionally moving. 
The lighting should be dramatic and golden-hour quality. 
The composition should be magazine-cover worthy, with the person as the triumphant hero of their own story.
Maintain the person's facial features and likeness while placing them in this aspirational scenario.
The mood should evoke hope, achievement, and the magic of dreams coming true.
Ultra high quality, cinematic lighting, professional photography, 8k resolution.`
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
