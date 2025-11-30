import { createServer } from 'http'
import { fal } from '@fal-ai/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const PORT = 3001

const DREAM_PLACEHOLDER = '{{DREAM}}'
const DEFAULT_PROMPT_TEMPLATE = `Medium shot of this character ${DREAM_PLACEHOLDER}`

function craftPrompt(dream, template) {
  const promptTemplate = template || DEFAULT_PROMPT_TEMPLATE
  return promptTemplate.replace(DREAM_PLACEHOLDER, dream)
}

async function enhancePromptWithLLM(dream) {
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

function getModelId(model) {
  switch (model) {
    case 'nano-banana-pro':
      return 'fal-ai/nano-banana-pro/edit'
    case 'seedream-v4-edit':
      return 'fal-ai/bytedance/seedream/v4/edit'
    case 'flux-2-edit':
    default:
      return 'fal-ai/flux-2/edit'
  }
}

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = ''
    
    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const { image, dream, model = 'seedream-v4-edit', promptTemplate } = JSON.parse(body)

        if (!image || !dream) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Image and dream are required' }))
          return
        }

        const falKey = process.env.FAL_KEY
        if (!falKey || falKey === 'your_fal_api_key_here') {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'FAL_KEY not configured. Please add your API key to .env.local' }))
          return
        }

        fal.config({ credentials: falKey })

        // Enhance prompt with LLM for SeedDream v4 edit model
        let prompt
        if (model === 'seedream-v4-edit') {
          console.log('🎨 Enhancing prompt with LLM for SeedDream v4 edit...')
          prompt = await enhancePromptWithLLM(dream)
          console.log('✨ Enhanced prompt:', prompt.substring(0, 150) + '...')
        } else {
          prompt = craftPrompt(dream, promptTemplate)
        }

        const modelId = getModelId(model)
        console.log(`Generating image with model: ${modelId}`)
        console.log('📤 Sending to fal.ai with prompt:', prompt.substring(0, 200) + '...')

        // Get model-specific parameters
        let inputParams
        if (model === 'seedream-v4-edit') {
          inputParams = {
            prompt,
            image_urls: [image],
            image_size: 'portrait_4_3',
            num_images: 1,
            enable_safety_checker: true,
            enhance_prompt_mode: 'standard',
          }
        } else {
          inputParams = {
            prompt,
            image_urls: [image],
            guidance_scale: 2.5,
            num_inference_steps: 28,
            image_size: 'portrait_4_3',
            num_images: 1,
            acceleration: 'regular',
            enable_safety_checker: true,
            output_format: 'png',
          }
        }

        const result = await fal.subscribe(modelId, {
          input: inputParams,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              console.log('Generation in progress...')
            }
          },
        })

        const imageUrl = result.data?.images?.[0]?.url

        if (!imageUrl) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to generate image' }))
          return
        }

        console.log('Image generated successfully!')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ imageUrl, prompt, model }))
      } catch (error) {
        console.error('Generation error:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message || 'Generation failed' }))
      }
    })
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

server.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}`)
  console.log('📝 Make sure to set your FAL_KEY in .env.local')
})
