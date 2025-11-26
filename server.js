import { createServer } from 'http'
import { fal } from '@fal-ai/client'
import { config } from 'dotenv'

config({ path: '.env.local' })

const PORT = 3001

function craftPrompt(dream) {
  return `Transform this portrait into an epic, cinematic visualization of their dream: "${dream}". 
The person should be shown actively living and achieving this dream in a breathtaking, photorealistic scene. 
Make it inspirational, powerful, and emotionally moving. 
The lighting should be dramatic and golden-hour quality. 
The composition should be magazine-cover worthy, with the person as the triumphant hero of their own story.
Maintain the person's facial features and likeness while placing them in this aspirational scenario.
The mood should evoke hope, achievement, and the magic of dreams coming true.
Ultra high quality, cinematic lighting, professional photography, 8k resolution.`
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
        const { image, dream } = JSON.parse(body)

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

        const prompt = craftPrompt(dream)
        console.log('Generating image with prompt:', prompt.substring(0, 100) + '...')

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
        res.end(JSON.stringify({ imageUrl, prompt }))
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

