export const config = {
  runtime: 'edge',
}

type ModelType = 'flux-2-edit' | 'nano-banana-pro'

const DREAM_PLACEHOLDER = '{{DREAM}}'
const DEFAULT_PROMPT_TEMPLATE = `Medium shot of this character ${DREAM_PLACEHOLDER}`

interface RequestBody {
  image: string
  dream: string
  model?: ModelType
  promptTemplate?: string
}

interface FalResponse {
  images?: Array<{ url: string }>
  prompt?: string
}

function craftPrompt(dream: string, template?: string): string {
  const promptTemplate = template || DEFAULT_PROMPT_TEMPLATE
  return promptTemplate.replace(DREAM_PLACEHOLDER, dream)
}

function getModelEndpoint(model: ModelType): string {
  switch (model) {
    case 'nano-banana-pro':
      return 'https://fal.run/fal-ai/nano-banana-pro/edit'
    case 'flux-2-edit':
    default:
      return 'https://fal.run/fal-ai/flux-2/edit'
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
    const body: RequestBody = await request.json()
    const { image, dream, model = 'nano-banana-pro', promptTemplate } = body

    if (!image || !dream) {
      return new Response(
        JSON.stringify({ error: 'Image and dream are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const prompt = craftPrompt(dream, promptTemplate)
    const endpoint = getModelEndpoint(model)

    // Use synchronous fal.ai endpoint (fal.run instead of queue.fal.run)
    const response = await fetch(endpoint, {
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

    return new Response(JSON.stringify({ imageUrl, prompt, model }), {
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
