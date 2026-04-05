# Smash Padel — Project Documentation

## What It Is

Smash is a mobile-first Progressive Web App (PWA) for running and scoring Americano-format padel tennis tournaments. Players register with a name and invite code, then use the app to organise sessions, enter match scores, and track standings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18.2.0 (Create React App) |
| Styling | Inline CSS + CSS custom properties (dark theme) |
| State | React hooks (`useState`, `useEffect`) |
| Persistence | `localStorage` (player ID) |
| PWA | Service Worker + Web Push API |
| Backend | Node.js REST API hosted on Render.com |

---

## Architecture

The app is a single-file React component (`src/App.js`) with five tabs rendered conditionally:

- **Home** — welcome screen, stats snapshot, quick-action buttons
- **Play** — Americano session setup and live match scoring
- **Ranks** — global leaderboard (all-time stats from backend)
- **Me** — player profile and statistics
- **Settings** — app version and about info

---

## Backend API (Render.com)

Base URL: `https://smash-backend-xwqc.onrender.com`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/players` | Register a new player (name + invite code) |
| GET | `/api/players` | List all players sorted by stats |
| GET | `/api/players/:id` | Get a single player's data |
| POST | `/api/sessions` | Create a session (legacy — now replaced locally) |
| GET | `/api/sessions/active` | Get active sessions |
| POST | `/api/sessions/:id/match/:idx` | Update a match score (legacy) |
| GET | `/api/vapid-public-key` | Get push notification key |
| POST | `/api/subscribe` | Register push notification subscription |

---

## Current Features (Pre-Update Baseline)

### Authentication
- Players register with a **name + invite code** — invite code gates app access
- Player ID stored in `localStorage` (`smash-playerId`)
- Sign out clears localStorage and returns to registration screen

### Session Setup
- Session name (free text)
- Points per game: 16, 24, 32, or 40
- Courts: 1–4
- Rounds: 3, 5, 7, or 10
- Player selection from registered players (minimum 4)

### Match Scoring
- Matches displayed as cards showing team names and score inputs
- Scores entered via number inputs; saved on blur
- Completed matches shown greyed out with final scores

### Global Leaderboard
- Podium display for top 3 players (all-time)
- Full ranked list with W/L record, total points, win rate

### Winner Popup
- Triggers when all session matches are completed
- Shows session winner and top 3 players

### PWA / Push Notifications
- App installable on mobile
- Push notifications subscribed on first load

---

## Feature Update (This Version)

### 1. Custom Points Per Game
A **"Custom"** button is added alongside `[16, 24, 32, 40]`. Selecting it reveals a number input allowing any points value.

### 2. Rounds: 7–12
Round options changed from `[3, 5, 7, 10]` to `[7, 8, 9, 10, 11, 12]`.

### 3. Guest Player Names
Inside the session setup screen, a session organiser can type extra player names and add them as **guest players** for that session only. Guests have no backend account — they exist locally for the duration of the session. App login (invite code) is still required for the organiser.

### 4. Auto-Calculate Score
When one team's score is entered, the other team's score auto-fills as `pointsPerGame − enteredScore`. Committed on blur.

### 5. Session Leaderboard
A **"SESSION STANDINGS"** section appears inside the live session view. It shows each player's total points scored in the current Americano, updated live as matches are completed. This is separate from the global all-time leaderboard.

### 6. Randomised Match Combinations
Session match generation moves to the **frontend**. A `generateAmericanoMatches()` function randomly shuffles players into court pairings for each round — so combinations differ every round and every session.

---

## Architecture Note (Post-Update)

Sessions are now **local-first**:
- Match generation happens in-browser (`generateAmericanoMatches`)
- Scores are tracked in React state (no backend score API calls)
- The session leaderboard is calculated from local match data
- The global leaderboard (Ranks tab) still reads from the backend

The backend is used for: player registration, loading the registered player list, and push notifications.
