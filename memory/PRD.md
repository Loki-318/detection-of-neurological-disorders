# NeuroScan AI — Product Requirements Document

## Overview
**NeuroScan AI** is a React Native Expo mobile app for preliminary neurological risk screening (Parkinson's, Alzheimer's, motor dysfunction) through simulated camera-based facial, gait, and behavioral analysis — now with AI-powered personalized analysis, historical trend charts, and weekly reminders.

## Tech Stack
- **Frontend**: Expo SDK 54, Expo Router (file-based routing), React Native Reanimated, react-native-svg, expo-camera, expo-notifications, AsyncStorage
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt, emergentintegrations (Claude Sonnet 4.5)
- **Database**: MongoDB (`neuroscan_ai` DB)

## Core Features
- **Auth**: Full JWT email/password (Bearer token, stored in AsyncStorage)
- **Dashboard**: Animated circular risk score, 3 metric cards (Gait/Face/Behavior), CTAs, mini 7-scan trend chart, weekly reminder toggle, low-score alert
- **Scan**: expo-camera preview + animated pulse overlay + simulated detection (Align → Detected → Analyzing)
- **Result**: Animated progress bars + risk pill (Low/Moderate/High) + **AI-generated summary & 3 personalized recommendations** from Claude Sonnet 4.5
- **AI Doctor Chat**: "Dr. Nova" powered by Claude Sonnet 4.5 with multi-turn memory per user
- **Trends tab**: 4 per-metric line charts, aggregate stats (Avg/Best/Low/Count), recent-scan log
- **Appointments**: 25 slots across 5 days, one-tap booking, upcoming list
- **Reminders**: Local weekly push-notification (Sun 9 AM) via expo-notifications (native devices only)

## Demo Credentials
- `demo@neuroscan.ai` / `Demo1234!`

## Business Enhancement Ideas (Future)
- **Premium tier**: Historical scan trend charts + PDF export for doctors → subscription revenue
- **In-app appointment fees** via Stripe (marketplace cut on each booking)
- **Referral program**: share scan → invite friend → both get free premium month (viral loop)

## Known Limitations
- Camera preview runs on native devices only; web preview shows fallback
- All scores are currently random placeholders — architecture ready for real ML model integration at `/api/scans`
