import { config } from 'dotenv'

config({ path: '.env.local' })

const testDreams = [
  "Flying through the clouds",
  "Winning an Olympic medal",
  "Performing on a world stage",
  "Discovering a new planet"
]

async function testPromptEnhancement(dream) {
  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!openRouterKey) {
    console.log('❌ OPENROUTER_API_KEY not found in .env.local')
    return null
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
      console.error('❌ OpenRouter API error:', errorText)
      return null
    }

    const data = await response.json()
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim()

    return enhancedPrompt
  } catch (error) {
    console.error('❌ Error:', error.message)
    return null
  }
}

async function runTests() {
  console.log('🧪 Testing Enhanced Prompt Generation\n')
  console.log('=' .repeat(80))
  console.log('')

  for (let i = 0; i < testDreams.length; i++) {
    const dream = testDreams[i]
    console.log(`\n📝 Test ${i + 1}/${testDreams.length}`)
    console.log(`Dream: "${dream}"`)
    console.log('-'.repeat(80))
    
    const prompt = await testPromptEnhancement(dream)
    
    if (prompt) {
      console.log('\n✨ Enhanced Prompt:')
      console.log(prompt)
      console.log('')
      console.log(`📊 Length: ${prompt.length} characters`)
    } else {
      console.log('❌ Failed to generate prompt')
    }
    
    console.log('')
    console.log('='.repeat(80))
    
    // Small delay between requests
    if (i < testDreams.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log('\n✅ Testing complete!')
}

runTests()

