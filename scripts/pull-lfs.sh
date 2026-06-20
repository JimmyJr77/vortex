#!/bin/bash
# Videos are hosted on CDN (VITE_CDN_BASE_URL), not Git LFS.
# Local dev: keep mp4 files in public/ (gitignored). Production: set VITE_CDN_BASE_URL on Vercel.
echo "Skipping Git LFS pull (videos served from CDN)"
exit 0
