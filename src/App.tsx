import { useState, useRef, useCallback } from 'react'
import './App.css'

type ImageSource = 'upload' | 'webcam' | 'example' | null
type ModelType = 'flux-2-edit' | 'nano-banana-pro'

interface GeneratedImage {
  url: string
  dream: string
}

const MODELS = [
  { id: 'flux-2-edit' as ModelType, name: 'FLUX 2 Edit', description: 'High quality, slower', costPerMP: 0.025 },
  { id: 'nano-banana-pro' as ModelType, name: 'Nano Banana Pro', description: 'Fast, good quality', costPerMP: 0.003 },
]

// Portrait 4:3 at typical resolution (1024x768 = 0.786 MP)
const ESTIMATED_MEGAPIXELS = 0.786

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
  '/examples/portrait-1.png',  // Aviz
  '/examples/portrait-3.png',  // Amos
  '/examples/portrait-4.png',  // Sahar
  '/examples/yuval.png',       // Yuval
  '/examples/itay.png',        // Itay
  '/examples/rita.png',        // Rita
]

const MAGIC_PHRASES = [
  "Weaving your dreams into reality...",
  "Sprinkling stardust on your vision...",
  "Painting your imagination...",
  "Manifesting your destiny...",
  "Creating magic just for you...",
  "Turning dreams into pixels...",
  "Channeling creative energy...",
  "Unlocking infinite possibilities...",
]

const DREAM_PLACEHOLDER = '{{DREAM}}'
const DEFAULT_PROMPT_TEMPLATE = `Medium shot of this character ${DREAM_PLACEHOLDER}`

function App() {
  const [imageSource, setImageSource] = useState<ImageSource>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [dream, setDream] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [magicPhrase, setMagicPhrase] = useState(MAGIC_PHRASES[0])
  const [selectedModel, setSelectedModel] = useState<ModelType>('nano-banana-pro')
  const [showSettings, setShowSettings] = useState(false)
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE)
  const [editingPrompt, setEditingPrompt] = useState(DEFAULT_PROMPT_TEMPLATE)
  const [promptError, setPromptError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const phraseIntervalRef = useRef<number | null>(null)

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
    // Clear any previous state
    setError(null)
    setSelectedImage(null)
    setGeneratedImage(null)
    
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Webcam is not supported in this browser. Please use Chrome, Firefox, or Safari.')
        return
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsWebcamActive(true)
        setImageSource('webcam')
      }
    } catch (err) {
      console.error('Webcam error:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera access denied. Please allow camera permissions in your browser settings.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found. Please connect a webcam and try again.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another application. Please close other apps using the camera.')
        } else {
          setError(`Unable to access webcam: ${err.message}`)
        }
      } else {
        setError('Unable to access webcam. Please check permissions.')
      }
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
        // Mirror the image horizontally to match the preview
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        setSelectedImage(dataUrl)
        setImageSource('webcam')
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

  const insertDreamPlaceholder = () => {
    if (promptInputRef.current) {
      const textarea = promptInputRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = editingPrompt.substring(0, start) + DREAM_PLACEHOLDER + editingPrompt.substring(end)
      setEditingPrompt(newValue)
      setPromptError(null)
      // Set cursor position after the inserted placeholder
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + DREAM_PLACEHOLDER.length, start + DREAM_PLACEHOLDER.length)
      }, 0)
    }
  }

  const savePromptTemplate = () => {
    if (!editingPrompt.includes(DREAM_PLACEHOLDER)) {
      setPromptError(`Prompt must include the ${DREAM_PLACEHOLDER} placeholder`)
      return
    }
    setPromptTemplate(editingPrompt)
    setPromptError(null)
  }

  const resetPromptTemplate = () => {
    setEditingPrompt(DEFAULT_PROMPT_TEMPLATE)
    setPromptTemplate(DEFAULT_PROMPT_TEMPLATE)
    setPromptError(null)
  }

  const startMagicPhrases = () => {
    let index = 0
    phraseIntervalRef.current = window.setInterval(() => {
      index = (index + 1) % MAGIC_PHRASES.length
      setMagicPhrase(MAGIC_PHRASES[index])
    }, 3000)
  }

  const stopMagicPhrases = () => {
    if (phraseIntervalRef.current) {
      clearInterval(phraseIntervalRef.current)
      phraseIntervalRef.current = null
    }
  }

  const generateDreamImage = async () => {
    if (!selectedImage || !dream.trim()) {
      setError('Please select an image and enter your dream')
      return
    }

    setIsGenerating(true)
    setError(null)
    startMagicPhrases()

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          dream: dream.trim(),
          model: selectedModel,
          promptTemplate: promptTemplate,
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
      stopMagicPhrases()
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
        <img src="/dreemz-logo.png" alt="Dreemz" className="logo" />
        <h1 className="title">Dreemizer</h1>
        <p className="subtitle">Transform your portrait into a vision of your dreams</p>
        <button 
          className="settings-toggle"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙️
        </button>
        {showSettings && (
          <div className="settings-panel">
            <h3>Model Selection</h3>
            <div className="model-options">
              {MODELS.map((model) => (
                <label key={model.id} className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={selectedModel === model.id}
                    onChange={() => setSelectedModel(model.id)}
                  />
                  <span className="model-name">{model.name}</span>
                  <span className="model-desc">{model.description}</span>
                </label>
              ))}
            </div>

            <h3>Prompt Template</h3>
            <div className="prompt-editor">
              <textarea
                ref={promptInputRef}
                value={editingPrompt}
                onChange={(e) => {
                  setEditingPrompt(e.target.value)
                  setPromptError(null)
                }}
                className="prompt-textarea"
                rows={3}
                placeholder="Enter your prompt template..."
              />
              <div className="prompt-chips">
                <button 
                  className="prompt-chip"
                  onClick={insertDreamPlaceholder}
                  title="Click to insert dream placeholder"
                >
                  {DREAM_PLACEHOLDER}
                </button>
                <span className="prompt-chip-hint">← Click to insert</span>
              </div>
              {promptError && (
                <div className="prompt-error">{promptError}</div>
              )}
              <div className="prompt-actions">
                <button 
                  className="prompt-save-btn"
                  onClick={savePromptTemplate}
                >
                  Save
                </button>
                <button 
                  className="prompt-reset-btn"
                  onClick={resetPromptTemplate}
                >
                  Reset
                </button>
              </div>
              {promptTemplate !== editingPrompt && (
                <div className="prompt-unsaved">Unsaved changes</div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="main">
        {isGenerating ? (
          <div className="loading-section">
            <div className="magic-loader">
              <div className="magic-circle">
                <div className="magic-ring ring-1"></div>
                <div className="magic-ring ring-2"></div>
                <div className="magic-ring ring-3"></div>
                <div className="magic-core"></div>
                <div className="magic-particles">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="particle" style={{ '--i': i } as React.CSSProperties}></div>
                  ))}
                </div>
              </div>
              <div className="magic-stars">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="star" style={{ '--i': i } as React.CSSProperties}>✦</div>
                ))}
              </div>
            </div>
            <h2 className="loading-title">Creating Your Dream Vision</h2>
            <p className="loading-phrase">{magicPhrase}</p>
            <div className="loading-progress">
              <div className="progress-bar"></div>
            </div>
          </div>
        ) : generatedImage ? (
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
              <div className="cost-estimation">
                <span className="cost-label">Estimated cost:</span>
                <span className="cost-value">
                  ${(ESTIMATED_MEGAPIXELS * (MODELS.find(m => m.id === selectedModel)?.costPerMP || 0.003)).toFixed(4)}
                </span>
                <span className="cost-model">({MODELS.find(m => m.id === selectedModel)?.name})</span>
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
                  className={`source-btn ${isWebcamActive ? 'active' : ''}`}
                  onClick={startWebcam}
                  disabled={isWebcamActive}
                >
                  <span className="source-icon">🎥</span>
                  <span className="source-label">Use Webcam</span>
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
                  <button onClick={stopWebcam} className="webcam-close" title="Close camera">✕</button>
                  <div className="webcam-controls">
                    <button onClick={capturePhoto} className="shutter-btn" title="Take photo">
                      <span className="shutter-inner"></span>
                    </button>
                  </div>
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
                <p className="examples-label">Or choose from the Dreemz team:</p>
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
              <span className="generate-icon">✨</span>
              Generate Dream Vision
        </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Dreemz • Made with ✨ imagination</p>
      </footer>
      </div>
  )
}

export default App
