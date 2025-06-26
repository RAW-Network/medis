#!/bin/sh

chown -R node:node /usr/src/app/videos

exec su-exec node "$@"