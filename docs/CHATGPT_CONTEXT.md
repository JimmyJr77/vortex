# Info for ChatGPT (Vortex app)

## 1. Header.tsx around line ~27

**Current state:** We no longer use `<motion.header>`. The header is a plain `<header>` with a CSS animation class to avoid the Framer Motion "container has a non-static position" warning.

**There are no `useScroll`, `useTransform`, or `useInView` calls in Header.tsx.**

Relevant snippet (lines 25–45):

```tsx
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in">
      <div className="container-custom">
        {/* Mobile Layout: Logo on top, buttons below */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 md:py-0 md:h-20">
          <div className="flex items-center justify-between md:justify-start mb-4 md:mb-0">
            <Link to="/" className="block">
              <motion.div 
                className="flex items-center cursor-pointer"
                whileHover={{ scale: 1.05 }}
              >
                <img 
                  src="/vortex_logo_1.png" 
                  alt="Vortex Athletics" 
                  className="h-12 md:h-16 w-auto"
                />
              </motion.div>
            </Link>
            {/* ... hamburger, nav buttons, etc. ... */}
```

- **Line 26:** `<header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm header-slide-in">` — plain HTML `<header>`, not `motion.header`.
- **Slide-in:** Done in CSS via class `header-slide-in` (keyframe `translateY(-100%)` → `translateY(0)`, 0.6s) in `index.css`.
- **Framer in Header:** Only used for `motion.div` (logo hover), `motion.button`, `motion.a`, and `motion.nav` (dropdown). No scroll/layout measurement on the header element itself.

---

## 2. How we're embedding Instagram

**We use Instagram’s official blockquote + script (no iframe).**

- **No** `<iframe src="...">` or sandbox iframe for Instagram.
- **Yes** `<blockquote class="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14">` plus loading `https://www.instagram.com/embed.js` and calling `instgrm.Embeds.process()`.

**Where it lives:** `HomePage.tsx` — video library section. When the user selects "Instagram", we render the blockquote and run the embed script.

**useEffect (load script + process):** (lines ~100–118)

```tsx
  useEffect(() => {
    if (selectedVideo.id !== 'instagram' || !('reelUrl' in selectedVideo) || !selectedVideo.reelUrl) return
    const run = () => {
      if (typeof window !== 'undefined' && (window as any).instgrm?.Embeds?.process) {
        (window as any).instgrm.Embeds.process()
      }
    }
    const existing = document.querySelector('script[src="https://www.instagram.com/embed.js"]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.instagram.com/embed.js'
      script.async = true
      document.body.appendChild(script)
      script.onload = run
    } else {
      run()
    }
  }, [selectedVideo])
```

**JSX (blockquote in viewer):** (lines ~241–254)

```tsx
                ) : 'reelUrl' in selectedVideo && selectedVideo.reelUrl ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/80 overflow-auto p-4">
                    <blockquote
                      className="instagram-media"
                      data-instgrm-permalink={selectedVideo.reelUrl}
                      data-instgrm-version="14"
                      style={{ margin: '0 auto', maxWidth: 540, width: '100%' }}
                    >
                      <a href={selectedVideo.reelUrl} target="_blank" rel="noopener noreferrer">
                        View on Instagram
                      </a>
                    </blockquote>
                  </div>
                ) : (
```

**Instagram post URL in data:**  
`reelUrl: 'https://www.instagram.com/p/DTs3e-YjoEx6yHTnpmrHPBQou0HpgsOS9cicMM0/'` (used for a single post embed; we call it `reelUrl` but it’s a post URL).

---

## 3. Other context

- **YouTube:** Embedded with a plain iframe (no sandbox): `src={selectedVideo.embedUrl}` (youtube-nocookie.com embed URL).
- **Warnings we already addressed:**  
  - Framer “container has non-static position” → fixed by using plain `<header>` + CSS animation.  
  - Iframe sandbox warning → removed; Instagram is blockquote + script only.  
- **Still present:** “Permissions policy violation: unload is not allowed” from Instagram’s `embed.js`; we can’t change their script.
