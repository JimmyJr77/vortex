/** Optional public media URLs. The bundled clip keeps the local preview self-contained. */
export const trainingVideoUrl = import.meta.env.VITE_NEWPAGE_VIDEO_URL?.trim() || '/newpage/training-loop.mp4'

/** Use a provider's HTTPS embed URL, e.g. YouTube Live or Vimeo, when a stream is available. */
export const liveTrainingEmbedUrl = import.meta.env.VITE_NEWPAGE_LIVE_EMBED_URL?.trim() || ''
