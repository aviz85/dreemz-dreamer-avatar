# Dreemizer ✨

Transform your portrait into a vision of your dreams using AI.

## Features

- **Upload Photo**: Upload any portrait image
- **Webcam Capture**: Take a photo directly from your webcam
- **Example Portraits**: Choose from pre-loaded example images
- **Dream Input**: Type your dream or select from suggestions
- **AI Generation**: Uses FLUX 2 Dev model via fal.ai to generate dream visualizations

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env.local` file in the root directory:

```
FAL_KEY=your_fal_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

- Get your FAL API key from [fal.ai dashboard](https://fal.ai/dashboard/keys)
- Get your OpenRouter API key from [OpenRouter dashboard](https://openrouter.ai/keys)

**Note:** The `OPENROUTER_API_KEY` is used to enhance prompts for the SeedDream v4 edit model. If not provided, it will fall back to a basic prompt.

### 3. Run locally

```bash
npm run dev
```

This starts both the Vite dev server and the API server.

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel project settings:
   - `FAL_KEY` - Your fal.ai API key
   - `OPENROUTER_API_KEY` - Your OpenRouter API key (optional, for SeedDream prompt enhancement)
4. Deploy

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: fal.ai FLUX 2 Dev (image edit)
- **Hosting**: Vercel Edge Functions
