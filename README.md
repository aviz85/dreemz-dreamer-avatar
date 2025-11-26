# Dream Visualizer ✨

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

### 2. Configure API Key

Create a `.env.local` file in the root directory:

```
FAL_KEY=your_fal_api_key_here
```

Get your API key from [fal.ai dashboard](https://fal.ai/dashboard/keys).

### 3. Run locally

```bash
npm run dev
```

This starts both the Vite dev server and the API server.

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add `FAL_KEY` environment variable in Vercel project settings
4. Deploy

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: fal.ai FLUX 2 Dev (image edit)
- **Hosting**: Vercel Edge Functions
