import React, { useState, useRef, useEffect } from 'react'
import { Upload, Play, Pause, Download, Loader2, Volume2, SkipBack, SkipForward } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { Textarea } from './ui/textarea'
import { Slider } from './ui/slider'
import { Input } from './ui/input'
import { blink } from '../blink/client'

interface Subtitle {
  id: string
  startTime: number
  endTime: number
  text: string
}

export function AudioSubtitleEditor() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([80])
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionProgress, setTranscriptionProgress] = useState(0)
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null)
  const [currentSubtitleId, setCurrentSubtitleId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auth state management
  useEffect(() => {
    try {
      const unsubscribe = blink.auth.onAuthStateChanged((state) => {
        setUser(state.user)
      })
      return unsubscribe
    } catch (error) {
      console.error('Auth state management error:', error)
      // Fallback: try to get user directly
      blink.auth.me().then(setUser).catch(() => {
        console.warn('Unable to get user, will show sign-in prompt')
      })
    }
  }, [])

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      const time = audio.currentTime
      setCurrentTime(time)
      
      // Find the current subtitle based on audio time
      const currentSub = subtitles.find(sub => 
        time >= sub.startTime && time <= sub.endTime
      )
      setCurrentSubtitleId(currentSub?.id || null)
    }
    
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentSubtitleId(null)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [audioUrl, subtitles])

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100
    }
  }, [volume])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate audio file
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file')
      return
    }

    setAudioFile(file)
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setSubtitles([])
    setSelectedSubtitle(null)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      setSubtitles([])
      setSelectedSubtitle(null)
    }
  }

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const skipBackward = () => {
    seekTo(Math.max(0, currentTime - 10))
  }

  const skipForward = () => {
    seekTo(Math.min(duration, currentTime + 10))
  }

  const transcribeAudio = async () => {
    if (!audioFile || !user) return

    setIsTranscribing(true)
    setTranscriptionProgress(0)

    try {
      // Convert file to base64 for transcription
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const base64Data = dataUrl.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(audioFile)
      })

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setTranscriptionProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      // Transcribe audio using Blink AI
      const { text } = await blink.ai.transcribeAudio({
        audio: base64Audio,
        language: 'en'
      })

      clearInterval(progressInterval)
      setTranscriptionProgress(100)

      // Convert transcription to subtitle format with better timing
      const words = text.split(' ').filter(word => word.trim().length > 0)
      
      // Create shorter segments (3-5 words per subtitle for better readability)
      const wordsPerSegment = 4
      // Use shorter time increments (2-3 seconds per segment)
      const baseSegmentDuration = 2.5
      
      const newSubtitles: Subtitle[] = []
      
      for (let i = 0; i < words.length; i += wordsPerSegment) {
        const segmentWords = words.slice(i, i + wordsPerSegment)
        
        // Calculate timing based on word count and natural speech patterns
        const segmentIndex = Math.floor(i / wordsPerSegment)
        const startTime = segmentIndex * baseSegmentDuration
        
        // Adjust duration based on word count and complexity
        const wordCount = segmentWords.length
        const avgWordLength = segmentWords.reduce((sum, word) => sum + word.length, 0) / wordCount
        
        // Longer words need more time, shorter segments can be quicker
        const durationMultiplier = Math.max(0.8, Math.min(1.5, avgWordLength / 5))
        const segmentDuration = Math.min(
          baseSegmentDuration * durationMultiplier,
          duration - startTime
        )
        
        const endTime = Math.min(startTime + segmentDuration, duration)
        
        // Skip if we've exceeded the audio duration
        if (startTime >= duration) break

        newSubtitles.push({
          id: `subtitle-${segmentIndex}`,
          startTime,
          endTime,
          text: segmentWords.join(' ')
        })
      }

      // If we have remaining time and fewer subtitles than expected, 
      // redistribute timing more evenly
      if (newSubtitles.length > 0) {
        const totalSubtitles = newSubtitles.length
        const timePerSubtitle = duration / totalSubtitles
        
        newSubtitles.forEach((subtitle, index) => {
          subtitle.startTime = index * timePerSubtitle
          subtitle.endTime = Math.min((index + 1) * timePerSubtitle, duration)
        })
      }

      setSubtitles(newSubtitles)
    } catch (error) {
      console.error('Transcription failed:', error)
      alert('Transcription failed. Please try again.')
    } finally {
      setIsTranscribing(false)
      setTranscriptionProgress(0)
    }
  }

  const updateSubtitleText = (id: string, newText: string) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, text: newText } : sub
    ))
  }

  const updateSubtitleTiming = (id: string, startTime: number, endTime: number) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, startTime, endTime } : sub
    ))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const parseTime = (timeString: string): number => {
    const parts = timeString.split(':')
    if (parts.length !== 2) return 0
    
    const minutes = parseInt(parts[0]) || 0
    const secondsParts = parts[1].split('.')
    const seconds = parseInt(secondsParts[0]) || 0
    const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0').slice(0, 3)) || 0
    
    return minutes * 60 + seconds + milliseconds / 1000
  }

  const exportSRT = () => {
    if (subtitles.length === 0) return

    let srtContent = ''
    subtitles.forEach((subtitle, index) => {
      const startTime = formatTime(subtitle.startTime)
      const endTime = formatTime(subtitle.endTime)
      
      srtContent += `${index + 1}\n`
      srtContent += `${startTime} --> ${endTime}\n`
      srtContent += `${subtitle.text}\n\n`
    })

    const blob = new Blob([srtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${audioFile?.name.replace(/\.[^/.]+$/, '') || 'subtitles'}.srt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center">Welcome to Audio Subtitle Editor</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Please sign in to start transcribing audio files into editable subtitles.
            </p>
            <Button onClick={() => blink.auth.login()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Audio Subtitle Editor</h1>
            <p className="text-muted-foreground">Transcribe audio files into editable subtitles</p>
          </div>
          <Button variant="outline" onClick={() => blink.auth.logout()}>
            Sign Out
          </Button>
        </div>

        {/* Audio Upload */}
        {!audioFile && (
          <Card>
            <CardContent className="p-8">
              <div
                className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload Audio File</h3>
                <p className="text-muted-foreground mb-4">
                  Drag and drop your audio file here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports MP3, WAV, M4A, FLAC, OGG, WebM
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio Player */}
        {audioFile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                {audioFile.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio ref={audioRef} src={audioUrl} />
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={([value]) => seekTo(value)}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={skipBackward}>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={togglePlayPause}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={skipForward}>
                  <SkipForward className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-2 ml-8">
                  <Volume2 className="w-4 h-4" />
                  <Slider
                    value={volume}
                    max={100}
                    step={1}
                    onValueChange={setVolume}
                    className="w-24"
                  />
                </div>
              </div>

              {/* Transcription */}
              <div className="flex gap-4">
                <Button 
                  onClick={transcribeAudio}
                  disabled={isTranscribing}
                  className="flex-1"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    'Auto-Transcribe'
                  )}
                </Button>
                
                {subtitles.length > 0 && (
                  <Button onClick={exportSRT} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export SRT
                  </Button>
                )}
              </div>

              {/* Transcription Progress */}
              {isTranscribing && (
                <div className="space-y-2">
                  <Progress value={transcriptionProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Processing audio... {transcriptionProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live Subtitle Display */}
        {subtitles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Live Subtitles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black/90 rounded-lg p-6 min-h-[120px] flex items-center justify-center">
                {currentSubtitleId ? (
                  (() => {
                    const currentSub = subtitles.find(s => s.id === currentSubtitleId)
                    if (!currentSub) return null
                    
                    // Calculate progress through current subtitle
                    const progress = Math.min(100, Math.max(0, 
                      ((currentTime - currentSub.startTime) / (currentSub.endTime - currentSub.startTime)) * 100
                    ))
                    
                    return (
                      <div className="text-center space-y-3 w-full">
                        <div className="text-white text-xl md:text-2xl font-medium leading-relaxed">
                          {currentSub.text}
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1">
                          <div 
                            className="bg-primary h-1 rounded-full transition-all duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-white/60 text-sm">
                          {formatTime(currentSub.startTime)} - {formatTime(currentSub.endTime)}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="text-white/60 text-lg">
                    {isPlaying ? 'No subtitle at current time' : 'Press play to see live subtitles'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subtitles Editor */}
        {subtitles.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subtitle List */}
            <Card>
              <CardHeader>
                <CardTitle>Subtitle Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {subtitles.map((subtitle) => {
                    const isCurrentlyPlaying = currentSubtitleId === subtitle.id
                    const isSelected = selectedSubtitle === subtitle.id
                    
                    return (
                      <div
                        key={subtitle.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                          isCurrentlyPlaying
                            ? 'border-accent bg-accent/10 shadow-md ring-2 ring-accent/20'
                            : isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedSubtitle(subtitle.id)
                          seekTo(subtitle.startTime)
                        }}
                      >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">
                          {formatTime(subtitle.startTime)} → {formatTime(subtitle.endTime)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            seekTo(subtitle.startTime)
                          }}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className={`text-sm line-clamp-2 ${
                        isCurrentlyPlaying 
                          ? 'text-accent-foreground font-medium' 
                          : 'text-muted-foreground'
                      }`}>
                        {subtitle.text}
                      </p>
                      {isCurrentlyPlaying && (
                        <div className="mt-2">
                          <div className="w-full bg-accent/20 rounded-full h-1">
                            <div 
                              className="bg-accent h-1 rounded-full transition-all duration-100 ease-linear"
                              style={{ 
                                width: `${Math.min(100, Math.max(0, 
                                  ((currentTime - subtitle.startTime) / (subtitle.endTime - subtitle.startTime)) * 100
                                ))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Subtitle Editor */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Subtitle</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedSubtitle ? (
                  <div className="space-y-4">
                    {(() => {
                      const subtitle = subtitles.find(s => s.id === selectedSubtitle)
                      if (!subtitle) return null
                      
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Start Time</label>
                              <Input
                                type="text"
                                value={formatTime(subtitle.startTime)}
                                onChange={(e) => {
                                  const newStartTime = parseTime(e.target.value)
                                  if (newStartTime >= 0 && newStartTime < subtitle.endTime) {
                                    updateSubtitleTiming(subtitle.id, newStartTime, subtitle.endTime)
                                  }
                                }}
                                placeholder="00:00.000"
                                className="font-mono text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">End Time</label>
                              <Input
                                type="text"
                                value={formatTime(subtitle.endTime)}
                                onChange={(e) => {
                                  const newEndTime = parseTime(e.target.value)
                                  if (newEndTime > subtitle.startTime && newEndTime <= duration) {
                                    updateSubtitleTiming(subtitle.id, subtitle.startTime, newEndTime)
                                  }
                                }}
                                placeholder="00:00.000"
                                className="font-mono text-sm"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Quick Timing Adjustments</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newStartTime = Math.max(0, subtitle.startTime - 0.5)
                                  updateSubtitleTiming(subtitle.id, newStartTime, subtitle.endTime)
                                }}
                              >
                                Start -0.5s
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newStartTime = Math.min(subtitle.endTime - 0.1, subtitle.startTime + 0.5)
                                  updateSubtitleTiming(subtitle.id, newStartTime, subtitle.endTime)
                                }}
                              >
                                Start +0.5s
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newEndTime = Math.max(subtitle.startTime + 0.1, subtitle.endTime - 0.5)
                                  updateSubtitleTiming(subtitle.id, subtitle.startTime, newEndTime)
                                }}
                              >
                                End -0.5s
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newEndTime = Math.min(duration, subtitle.endTime + 0.5)
                                  updateSubtitleTiming(subtitle.id, subtitle.startTime, newEndTime)
                                }}
                              >
                                End +0.5s
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Subtitle Text</label>
                            <Textarea
                              value={subtitle.text}
                              onChange={(e) => updateSubtitleText(subtitle.id, e.target.value)}
                              placeholder="Enter subtitle text..."
                              rows={4}
                            />
                          </div>
                          
                          <Button
                            onClick={() => seekTo(subtitle.startTime)}
                            variant="outline"
                            className="w-full"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Play from Start
                          </Button>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Select a subtitle from the timeline to edit
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}