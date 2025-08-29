#!/bin/bash

# Vercel Environment Variables Setup Script
# Run this after creating your Vercel project

echo "Setting up Vercel environment variables..."

# Production environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://ubbmwemyibhffpqnlvql.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzOTkxMzUsImV4cCI6MjA3MDk3NTEzNX0.pCyjwRWDabZ0kS1DtZH63wvc1Cr4bxMFdoM4NzAKsGk"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYm13ZW15aWJoZmZwcW5sdnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM5OTEzNSwiZXhwIjoyMDcwOTc1MTM1fQ.p65zS7ta4ctqCTe4VRnTu_Ofba2k8Ke1s_ApaP5wVmU"
vercel env add WEBHOOK_SECRET production <<< "stem-separator-webhook-secret-2025"

# Optional: Modal integration (add if you have Modal configured)
# vercel env add MODAL_TRIGGER_URL production <<< "YOUR_MODAL_WEBHOOK_URL"
# vercel env add MODAL_TRIGGER_SECRET production <<< "YOUR_MODAL_SECRET"

echo "Environment variables set! Now deploy with: vercel --prod"