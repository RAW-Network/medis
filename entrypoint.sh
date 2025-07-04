#!/bin/sh

# Link external volumes to the application's working directory.
ln -sfn /videos /app/videos
ln -sfn /cookies /app/cookies

# Ensure the non-root 'node' user has write permissions to the volumes.
chown -R node:node /videos
chown -R node:node /cookies

# Switch to the 'node' user and execute the main container command (CMD).
exec su-exec node "$@"