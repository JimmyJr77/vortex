#!/bin/bash
set +e  # Don't exit on error - we want to continue build even if LFS fails

echo "=== Git LFS Pull Script ==="

# Check if git-lfs is installed, try to install if not found
if ! command -v git-lfs &> /dev/null; then
  echo "⚠️  WARNING: Git LFS not found in PATH"
  echo "Attempting to install Git LFS..."
  
  # Try to install git-lfs (works on Vercel's Ubuntu-based build environment)
  if command -v apt-get &> /dev/null; then
    echo "Installing Git LFS via apt (Vercel/Ubuntu)..."
    # Vercel build environment should allow apt-get without sudo
    apt-get update -qq 2>&1 | head -20
    apt-get install -y git-lfs 2>&1 | head -20
  elif command -v brew &> /dev/null; then
    echo "Installing Git LFS via Homebrew..."
    brew install git-lfs 2>&1 | head -20
  else
    echo "⚠️  No package manager found. Trying manual installation..."
    # Try downloading and installing Git LFS manually
    curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | bash 2>&1 | head -20 || true
    apt-get install -y git-lfs 2>&1 | head -20 || true
  fi
  
  # Check again after potential install
  if ! command -v git-lfs &> /dev/null; then
    echo "❌ Git LFS installation failed or not available."
    echo "⚠️  Videos will NOT work in production (pointer files will be deployed)."
    echo "💡 Solutions:"
    echo "   1. Contact Vercel support to enable Git LFS"
    echo "   2. Host videos on a CDN (Cloudflare R2, AWS S3, etc.)"
    echo "   3. Use Vercel's build command to install Git LFS"
    exit 0  # Continue build - videos will fail but site won't break
  else
    echo "✅ Git LFS installed successfully"
  fi
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

# Pull LFS files with more verbose output
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
      # Check if it's a pointer file by checking for LFS pointer signature
      if head -c 200 "$video" 2>/dev/null | grep -q "version https://git-lfs"; then
        echo "❌ ERROR: $video is a Git LFS pointer file, not the actual video!"
        echo "   This means Git LFS files were not properly pulled."
        all_good=false
      elif [ "$size" -lt 1000 ]; then
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
    echo "❌ ERROR: Some video files are pointer files, not actual videos!"
    echo "⚠️  Videos will NOT work in production!"
    echo "💡 Solutions:"
    echo "   1. Ensure Git LFS is installed on your build server (Vercel)"
    echo "   2. Host videos on a CDN (Cloudflare R2, AWS S3, etc.)"
    echo "   3. Check Vercel build logs for Git LFS errors"
    # Don't exit with error - allow build to continue
  fi
else
  echo "❌ ERROR: Failed to pull Git LFS files"
  echo "⚠️  Videos will not be available in production!"
  echo "💡 Consider hosting videos on a CDN (Cloudflare R2, AWS S3, etc.)"
  # Don't exit with error - allow build to continue
  exit 0
fi

