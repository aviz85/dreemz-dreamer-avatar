import { useState, useRef, useCallback } from 'react'
import './App.css'

type ImageSource = 'upload' | 'webcam' | 'example' | null

interface GeneratedImage {
  url: string
  dream: string
}

const DREAM_EXAMPLES = [
  "Flying through the clouds",
  "Walking on the moon",
  "Swimming with dolphins",
  "Performing on a world stage",
  "Climbing Mount Everest",
  "Winning an Olympic medal",
  "Traveling through time",
  "Discovering a new planet",
]

const EXAMPLE_PORTRAITS = [
  '/examples/portrait-1.jpg',
  '/examples/portrait-2.jpg',
  '/examples/portrait-3.jpg',
  '/examples/portrait-4.jpg',
]

function App() {
  const [imageSource, setImageSource] = useState<ImageSource>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [dream, setDream] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string)
        setImageSource('upload')
        setGeneratedImage(null)
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsWebcamActive(true)
        setImageSource('webcam')
        setSelectedImage(null)
        setGeneratedImage(null)
        setError(null)
      }
    } catch {
      setError('Unable to access webcam. Please check permissions.')
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        setSelectedImage(dataUrl)
        stopWebcam()
      }
    }
  }

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsWebcamActive(false)
  }, [])

  const selectExample = async (url: string) => {
    setImageSource('example')
    setGeneratedImage(null)
    setError(null)
    stopWebcam()
    
    // Convert example image to base64 for fal.ai API
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(blob)
    } catch {
      setError('Failed to load example image')
    }
  }

  const handleDreamChipClick = (dreamText: string) => {
    setDream(dreamText)
  }

  const generateDreamImage = async () => {
    if (!selectedImage || !dream.trim()) {
      setError('Please select an image and enter your dream')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          dream: dream.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const data = await response.json()
      setGeneratedImage({
        url: data.imageUrl,
        dream: dream.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsGenerating(false)
    }
  }

  const resetAll = () => {
    setSelectedImage(null)
    setImageSource(null)
    setDream('')
    setGeneratedImage(null)
    setError(null)
    stopWebcam()
  }

  return (
    <div className="app">
      <div className="background-effects">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      <header className="header">
        <h1 className="title">
          <span className="title-icon">✨</span>
          Dreemizer
        </h1>
        <p className="subtitle">Transform your portrait into a vision of your dreams</p>
      </header>

      <main className="main">
        {generatedImage ? (
          <div className="result-section">
            <div className="result-card">
              <div className="result-header">
                <h2>Your Dream Realized</h2>
                <p className="dream-text">"{generatedImage.dream}"</p>
              </div>
              <div className="result-images">
                <div className="image-comparison">
                  <div className="comparison-item">
                    <span className="comparison-label">Original</span>
                    <img src={selectedImage!} alt="Original portrait" />
                  </div>
                  <div className="arrow">→</div>
                  <div className="comparison-item result">
                    <span className="comparison-label">Dream Vision</span>
                    <img src={generatedImage.url} alt="Dream visualization" />
                  </div>
                </div>
              </div>
              <div className="result-actions">
                <a 
                  href={generatedImage.url} 
                  download="dream-vision.png"
                  className="btn btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download Image
                </a>
                <button onClick={resetAll} className="btn btn-secondary">
                  Create Another Dream
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="creator-section">
            <div className="step step-1">
              <div className="step-header">
                <span className="step-number">1</span>
                <h2>Choose Your Portrait</h2>
              </div>
              
              <div className="image-source-options">
                <button 
                  className={`source-btn ${imageSource === 'upload' ? 'active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="source-icon">📁</span>
                  <span className="source-label">Upload Photo</span>
                </button>
                
                <button 
                  className={`source-btn ${imageSource === 'webcam' || isWebcamActive ? 'active' : ''}`}
                  onClick={isWebcamActive ? capturePhoto : startWebcam}
                >
                  <span className="source-icon">{isWebcamActive ? '📸' : '🎥'}</span>
                  <span className="source-label">{isWebcamActive ? 'Capture' : 'Use Webcam'}</span>
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {isWebcamActive && (
                <div className="webcam-container">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="webcam-video"
                  />
                  <button onClick={stopWebcam} className="webcam-close">✕</button>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {selectedImage && !isWebcamActive && (
                <div className="selected-image-preview">
                  <img src={selectedImage} alt="Selected portrait" />
                  <button onClick={resetAll} className="preview-close">✕</button>
                </div>
              )}

              <div className="examples-section">
                <p className="examples-label">Or choose from examples:</p>
                <div className="examples-grid">
                  {EXAMPLE_PORTRAITS.map((url, index) => (
                    <button
                      key={index}
                      className={`example-btn ${selectedImage === url ? 'selected' : ''}`}
                      onClick={() => selectExample(url)}
                    >
                      <img src={url} alt={`Example portrait ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="step step-2">
              <div className="step-header">
                <span className="step-number">2</span>
                <h2>What's Your Dream?</h2>
              </div>
              
              <div className="dream-input-container">
                <input
                  type="text"
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  placeholder="Describe your dream..."
                  className="dream-input"
                  maxLength={200}
                />
                <span className="char-count">{dream.length}/200</span>
              </div>

              <div className="dream-chips">
                {DREAM_EXAMPLES.map((example, index) => (
                  <button
                    key={index}
                    className={`chip ${dream === example ? 'active' : ''}`}
                    onClick={() => handleDreamChipClick(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button
              onClick={generateDreamImage}
              disabled={!selectedImage || !dream.trim() || isGenerating}
              className="generate-btn"
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  Crafting Your Dream...
                </>
              ) : (
                <>
                  <span className="generate-icon">🌟</span>
                  Generate Dream Vision
                </>
              )}
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by AI • Made with ✨ imagination</p>
      </footer>
    </div>
  )
}

export default App
