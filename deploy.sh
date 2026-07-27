#!/bin/bash

echo "Pulling from git..."
git pull

echo "Building Docker image..."
docker build -t bbchess .

echo "Stopping old container..."
docker stop bbchess 2>/dev/null || true

echo "Removing old container..."
docker rm bbchess 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name bbchess \
  -p 3001:3000 \
  -v /home/frocket/BBChessData:/app/data \
  bbchess

echo "Deployment complete!"
