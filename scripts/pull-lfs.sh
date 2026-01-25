#!/bin/bash
set +e  # Don't exit on error - we want to continue build even if LFS fails

echo "=== Git LFS Pull Script ==="

# Check if git-lfs is installed
if ! command -v git-lfs &> /dev/null; then
  echo "⚠️  WARNING: Git LFS not found in PATH"
  echo "Videos may not be available in production."
  echo "Consider hosting videos on a CDN instead."
  exit 0  # Continue build - videos will fail but site won't break
fi

echo "✅ Git LFS found: $(git-lfs version)"

# Initialize Git LFS if not already initialized
echo "Initializing Git LFS..."
git lfs install 2>/dev/null || echo "Git LFS already initialized or install failed"

# Check if we're in a git repository
if [ ! -d .git ]; then
  echo "⚠️  WARNING: Not in a git repository. Skipping LFS pull."
  exit 0
fi

# Pull LFS files
echo "Pulling Git LFS files..."
if git lfs pull 2>&1; then
  echo "✅ Git LFS files pulled successfully"
  
  # Verify the video files exist and are actual files (not pointers)
  echo "Verifying video files..."
  all_good=true
  for video in public/*.mp4; do
    if [ -f "$video" ]; then
      # Get file size (works on both macOS and Linux)
      size=$(stat -f%z "$video" 2>/dev/null || stat -c%s "$video" 2>/dev/null || echo "0")
      if [ "$size" -lt 1000 ]; then
        echo "⚠️  WARNING: $video appears to be a pointer file (size: $size bytes)"
        all_good=false
      else
        echo "✅ $video is a real file (size: $((size / 1024 / 1024))MB)"
      fi
    fi
  done
  
  if [ "$all_good" = true ]; then
    echo "✅ All video files verified successfully"
  else
    echo "⚠️  WARNING: Some video files may be pointer files, not actual videos"
  fi
else
  echo "❌ ERROR: Failed to pull Git LFS files"
  echo "⚠️  Videos will not be available in production!"
  echo "💡 Consider hosting videos on a CDN (Cloudflare R2, AWS S3, etc.)"
  # Don't exit with error - allow build to continue
  exit 0
fi

