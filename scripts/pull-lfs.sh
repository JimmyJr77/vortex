#!/bin/bash
set -e

# Check if git-lfs is installed
if ! command -v git-lfs &> /dev/null; then
  echo "Warning: Git LFS not found. Videos may not be available in production."
  echo "Please ensure Git LFS is enabled in your Vercel project settings."
  exit 0
fi

# Initialize Git LFS if not already initialized (non-blocking)
git lfs install || true

# Pull LFS files
echo "Pulling Git LFS files..."
if git lfs pull; then
  echo "Git LFS files pulled successfully"
else
  echo "Warning: Failed to pull Git LFS files. Videos may not be available."
  exit 0
fi

