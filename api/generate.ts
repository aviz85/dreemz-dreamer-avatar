export const config = {
  runtime: 'edge',
}

type ModelType = 'flux-2-edit' | 'nano-banana-pro' | 'seedream-v4-edit'

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

async function enhancePromptWithLLM(dream: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!openRouterKey) {
    // Fallback to basic prompt if API key not configured
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
        model: 'openai/gpt-4o', // Using gpt-4o (can be changed to gpt-4.1 if available)
        messages: [
          {
            role: 'system',
            content: 'You are a creative prompt engineer specializing in image generation. Focus on peak moments of success and joy. Create vivid, detailed prompts that capture the essence of achievement and positive energy, while maintaining a medium shot composition.',
          },
          {
            role: 'user',
            content: `Describe a peak moment of success in this dream: "${dream}". Focus on a specific situation that symbolizes success the most - a moment that delivers success and joy, with good vibes and energy. Describe vibrant details about the character's expression, emotions, and immediate surroundings, but keep it focused on a medium shot composition. Don't describe the entire environment in detail as that would create a long shot. Focus on the character and their immediate success moment.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter API error:', errorText)
      // Fallback to basic prompt
      return `Medium shot of this character ${dream}`
    }

    const data = await response.json()
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim()

    if (!enhancedPrompt) {
      // Fallback to basic prompt
      return `Medium shot of this character ${dream}`
    }

    return enhancedPrompt
  } catch (error) {
    console.error('Error enhancing prompt with LLM:', error)
    // Fallback to basic prompt
    return `Medium shot of this character ${dream}`
  }
}

function getModelEndpoint(model: ModelType): string {
  switch (model) {
    case 'nano-banana-pro':
      return 'https://fal.run/fal-ai/nano-banana-pro/edit'
    case 'seedream-v4-edit':
      return 'https://fal.run/fal-ai/bytedance/seedream/v4/edit'
    case 'flux-2-edit':
    default:
      return 'https://fal.run/fal-ai/flux-2/edit'
  }
}

function getModelParams(model: ModelType, prompt: string, image: string) {
  const baseParams = {
    prompt,
    image_urls: [image],
  }

  switch (model) {
    case 'seedream-v4-edit':
      return {
        ...baseParams,
        image_size: 'portrait_4_3',
        num_images: 1,
        enable_safety_checker: true,
        enhance_prompt_mode: 'standard' as const,
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
    const { image, dream, model = 'seedream-v4-edit', promptTemplate } = body

    if (!image || !dream) {
      return new Response(
        JSON.stringify({ error: 'Image and dream are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Enhance prompt with LLM for SeedDream v4 edit model
    let prompt: string
    if (model === 'seedream-v4-edit') {
      console.log('🎨 Enhancing prompt with LLM for SeedDream v4 edit...')
      prompt = await enhancePromptWithLLM(dream)
      console.log('✨ Enhanced prompt:', prompt.substring(0, 150) + '...')
    } else {
      prompt = craftPrompt(dream, promptTemplate)
    }

    const endpoint = getModelEndpoint(model)
    const modelParams = getModelParams(model, prompt, image)
    console.log('📤 Sending to fal.ai with prompt:', modelParams.prompt?.substring(0, 150) + '...')

    // Use synchronous fal.ai endpoint (fal.run instead of queue.fal.run)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelParams),
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
