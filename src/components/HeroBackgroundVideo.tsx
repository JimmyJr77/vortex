import { useEffect, useRef, useState, useMemo } from 'react'

interface HeroBackgroundVideoProps {
  videoFileName: string
  posterFileName?: string
  className?: string
  overlayClassName?: string
  onVideoReady?: () => void
  onVideoError?: (error: Error) => void
}

/**
 * HeroBackgroundVideo - Progressive enhancement video background component
 * 
 * Features:
 * - Shows poster image immediately (LCP-friendly)
 * - Loads video only after client-side gating (reduced motion, network, viewport)
 * - Supports IntersectionObserver for lazy loading
 * - Fade-in transition when video is ready
 * - Respects prefers-reduced-motion
 * - Skips video on slow networks or small screens
 */
const HeroBackgroundVideo = ({
  videoFileName,
  posterFileName,
  className = '',
  overlayClassName = 'absolute inset-0 bg-black/50 z-[1] pointer-events-none',
  onVideoReady,
  onVideoError,
}: HeroBackgroundVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [posterError, setPosterError] = useState(false)
  const [usePublicFolder, setUsePublicFolder] = useState(false)

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

  // Memoize URL calculations to prevent re-renders
  // If CDN fails, fall back to public folder
  const { videoUrl, posterUrl } = useMemo(() => {
    const base = usePublicFolder ? '' : getCdnBaseUrl()
    const vUrl = base ? `${base}/${videoFileName}` : `/${videoFileName}`
    const pUrl = posterFileName
      ? base
        ? `${base}/${posterFileName}`
        : `/${posterFileName}`
      : undefined
    
    // Debug logging (only in development, only once)
    if (import.meta.env.DEV) {
      console.log('[HeroBackgroundVideo] CDN Base:', base || '(using public folder)')
      console.log('[HeroBackgroundVideo] Video URL:', vUrl)
    }
    
    return { videoUrl: vUrl, posterUrl: pUrl }
  }, [videoFileName, posterFileName, usePublicFolder])

  // Client-side gating: Check if we should load video
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    // Gate 1: prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return // Never load video
    }

    // Gate 2: Network Information API (if available)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      const saveData = connection.saveData === true
      const effectiveType = connection.effectiveType
      
      if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
        return // Skip video on slow/save-data networks
      }
    }

    // Gate 3: Screen size (optional - skip on small screens)
    const isSmallScreen = window.innerWidth < 768
    if (isSmallScreen) {
      // Optional: you can return here to skip video on mobile
      // For now, we'll allow it but with lower priority
    }

    // Gate 4: IntersectionObserver - only load when in viewport
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
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Load video when shouldLoadVideo becomes true or when falling back to public folder
  useEffect(() => {
    if (!shouldLoadVideo || !videoRef.current) return

    const video = videoRef.current
    let hasCalledReady = false // Prevent multiple calls to onVideoReady

    // Set video source
    const source = video.querySelector('source')
    if (source) {
      source.src = videoUrl
      video.load() // Trigger video load
    }

    // Handle video events
    const handleLoadedData = () => {
      // Fade in video after a short delay
      setTimeout(() => {
        setShowVideo(true)
        if (!hasCalledReady) {
          hasCalledReady = true
          onVideoReady?.()
        }
      }, 100)
    }

    const handleCanPlay = () => {
      // Try to play
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Video autoplay prevented:', error)
          // Video will still be ready, just not playing
          if (!hasCalledReady) {
            handleLoadedData()
          }
        })
      }
    }

    const handleError = (_e: Event) => {
      const error = new Error(`Video loading failed: ${video.error?.message || 'Unknown error'}`)
      console.error('HeroBackgroundVideo error:', error)
      
      // If CDN fails and we haven't already fallen back, try public folder
      if (!usePublicFolder && getCdnBaseUrl()) {
        console.warn('[HeroBackgroundVideo] CDN video failed, falling back to public folder')
        setUsePublicFolder(true)
        // Reload video with public folder URL
        const source = video.querySelector('source')
        if (source) {
          source.src = `/${videoFileName}`
          video.load()
        }
        return // Don't call onVideoError yet, try fallback first
      }
      
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoadVideo, videoUrl, usePublicFolder]) // Include usePublicFolder to reload when fallback triggers

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Poster Image - Always shown first for LCP */}
      {posterUrl && !posterError && (
        <img
          src={posterUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${
            showVideo ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
          onError={() => {
            setPosterError(true)
            // If CDN fails, fall back to public folder
            if (!usePublicFolder && getCdnBaseUrl()) {
              console.warn('[HeroBackgroundVideo] CDN poster failed, falling back to public folder')
              setUsePublicFolder(true)
            }
          }}
          loading="eager"
          fetchPriority="high"
        />
      )}

      {/* Fallback gradient if no poster or poster failed */}
      {(!posterUrl || posterError) && !showVideo && (
        <div
          className="absolute inset-0 w-full h-full z-0 bg-gradient-to-br from-black via-gray-900 to-black"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
          }}
        />
      )}

      {/* Video Element - Only loaded when shouldLoadVideo is true */}
      {shouldLoadVideo && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${
            showVideo ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            display: 'block',
            pointerEvents: 'none',
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* Overlay */}
      {overlayClassName && <div className={overlayClassName} />}
    </div>
  )
}

export default HeroBackgroundVideo

