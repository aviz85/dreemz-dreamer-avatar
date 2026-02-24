export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
}

type ModelType = 'flux-2-edit' | 'nano-banana-pro' | 'seedream-v45-edit'

const DREAM_PLACEHOLDER = '{{DREAM}}'
const DEFAULT_PROMPT_TEMPLATE = `Medium shot of this character ${DREAM_PLACEHOLDER}`

const FAL_QUEUE_BASE = 'https://queue.fal.run'

interface RequestBody {
  image: string
  dream: string
  model?: ModelType
  promptTemplate?: string
}

function craftPrompt(dream: string, template?: string): string {
  const promptTemplate = template || DEFAULT_PROMPT_TEMPLATE
  return promptTemplate.replace(DREAM_PLACEHOLDER, dream)
}

async function enhancePromptWithLLM(dream: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!openRouterKey) {
    return `Medium shot of this character ${dream}`
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://dreemz.ai',
        'X-Title': 'Dreemizer',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a prompt engineer. Create short, sharp, and concise descriptions of peak success moments. Focus on the character and their immediate situation, not the environment.',
          },
          {
            role: 'user',
            content: `Describe a peak moment of success for this dream: "${dream}". Be short, sharp, and concise. Focus on the character's expression, emotions, and the specific success moment. Keep it medium shot - describe the character, not the environment. Maximum 2-3 sentences.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 120,
      }),
    })

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text())
      return `Medium shot of this character ${dream}`
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || `Medium shot of this character ${dream}`
  } catch (error) {
    console.error('Error enhancing prompt with LLM:', error)
    return `Medium shot of this character ${dream}`
  }
}

function getModelId(model: ModelType): string {
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

function getModelParams(model: ModelType, prompt: string, image: string) {
  const baseParams = {
    prompt,
    image_urls: [image],
  }

  switch (model) {
    case 'seedream-v45-edit':
      return {
        ...baseParams,
        num_images: 1,
        enable_safety_checker: true,
      }
    case 'nano-banana-pro':
    case 'flux-2-edit':
    default:
      return {
        ...baseParams,
        guidance_scale: 2.5,
        num_inference_steps: 28,
        image_size: 'portrait_4_3',
        num_images: 1,
        acceleration: 'regular',
        enable_safety_checker: true,
        output_format: 'png',
      }
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
    const { image, dream, model = 'seedream-v45-edit', promptTemplate } = body

    if (!image || !dream) {
      return new Response(
        JSON.stringify({ error: 'Image and dream are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    let prompt: string
    if (model === 'seedream-v45-edit') {
      console.log('Enhancing prompt with LLM for SeedDream v4.5...')
      prompt = await enhancePromptWithLLM(dream)
      console.log('Enhanced prompt:', prompt.substring(0, 150))
    } else {
      prompt = craftPrompt(dream, promptTemplate)
    }

    const modelId = getModelId(model)
    const modelParams = getModelParams(model, prompt, image)

    // Submit to fal.ai Queue REST API
    const falResponse = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelParams),
    })

    if (!falResponse.ok) {
      const errText = await falResponse.text()
      console.error('fal.ai queue submit error:', falResponse.status, errText)
      throw new Error(`fal.ai error: ${falResponse.status}`)
    }

    const falData = await falResponse.json()
    console.log('Request submitted:', falData.request_id)

    // Return request_id AND the status/response URLs from fal.ai
    // These URLs use a shortened path that's different from the model ID
    return new Response(JSON.stringify({
      requestId: falData.request_id,
      statusUrl: falData.status_url,
      responseUrl: falData.response_url,
      model,
      prompt,
      status: 'queued'
    }), {
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
