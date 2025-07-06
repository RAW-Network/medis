#!/bin/sh

# Define the main application directory
APP_DIR="/home/app/medis"

# Ensure persistent storage directories exist for videos and cookies
mkdir -p /videos
mkdir -p /cookies

# Create symbolic links from app storage to persistent Docker volumes
ln -sfn /videos ${APP_DIR}/storage/videos
ln -sfn /cookies ${APP_DIR}/storage/cookies

# Set ownership for persistent storage directories
chown -R medis:medis /videos
chown -R medis:medis /cookies

# Start the application using dumb-init
exec /usr/bin/dumb-init -- su-exec app "$@"