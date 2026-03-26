#!/usr/bin/env bash
# SmartTerm - Cloudflare Tunnel Setup
# Run this to expose your SmartTerm instance to the internet
# so you can access it from your phone.
#
# Prerequisites:
#   1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
#      Windows: winget install Cloudflare.cloudflared
#      Mac: brew install cloudflared
#   2. Login: cloudflared tunnel login
#
# Usage:
#   bash scripts/tunnel.sh
#
# This creates a quick tunnel (no config needed) that gives you a URL like:
#   https://random-words.trycloudflare.com
# Bookmark that URL on your phone!

PORT="${SMARTTERM_PORT:-4800}"

echo ""
echo "  SmartTerm Tunnel"
echo "  ================"
echo ""
echo "  Starting Cloudflare tunnel to localhost:$PORT"
echo "  Your phone URL will appear below..."
echo ""

cloudflared tunnel --url "http://localhost:$PORT"
