import { useEffect, useRef, useState } from 'react'

interface CdnVideoProps {
  videoFileName: string
  posterFileName?: string
  className?: string
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  playsInline?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  onVideoReady?: () => void
  onVideoError?: (error: Error) => void
}

/**
 * CdnVideo - Lightweight component for CDN-hosted videos
 * 
 * Features:
 * - Uses CDN URL from environment variable
 * - IntersectionObserver for lazy loading
 * - Optional poster image
 * - Configurable video attributes
 */
const CdnVideo = ({
  videoFileName,
  posterFileName,
  className = '',
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  playsInline = true,
  preload = 'metadata',
  onVideoReady,
  onVideoError,
}: CdnVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)

  // Get CDN base URL from environment variable
  const getCdnBaseUrl = (): string => {
    const cdnUrl = import.meta.env.VITE_CDN_BASE_URL
    if (cdnUrl) {
      // Ensure no trailing slash
      return cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl
    }
    // Fallback to public folder for local development
    return ''
  }

  const cdnBase = getCdnBaseUrl()
  const videoUrl = cdnBase ? `${cdnBase}/${videoFileName}` : `/${videoFileName}`
  const posterUrl = posterFileName
    ? cdnBase
      ? `${cdnBase}/${posterFileName}`
      : `/${posterFileName}`
    : undefined

  // IntersectionObserver for lazy loading
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoadVideo(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.1,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Load video when shouldLoadVideo becomes true
  useEffect(() => {
    if (!shouldLoadVideo || !videoRef.current) return

    const video = videoRef.current

    // Set video source
    const source = video.querySelector('source')
    if (source) {
      source.src = videoUrl
      video.load() // Trigger video load
    }

    // Handle video events
    const handleLoadedData = () => {
      onVideoReady?.()
    }

    const handleCanPlay = () => {
      if (autoplay) {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn('Video autoplay prevented:', error)
          })
        }
      }
    }

    const handleError = (_e: Event) => {
      const error = new Error(`Video loading failed: ${video.error?.message || 'Unknown error'}`)
      console.error('CdnVideo error:', error)
      onVideoError?.(error)
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
    }
  }, [shouldLoadVideo, videoUrl, autoplay, onVideoReady, onVideoError])

  return (
    <div ref={containerRef} className={className}>
      {shouldLoadVideo ? (
        <video
          ref={videoRef}
          controls={controls}
          autoPlay={autoplay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          preload={preload}
          poster={posterUrl}
          className="w-full h-full"
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        // Placeholder while waiting to load
        posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <span className="text-gray-500">Loading video...</span>
          </div>
        )
      )}
    </div>
  )
}

export default CdnVideo

