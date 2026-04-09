# F1 Championship Manager

A full-stack Formula 1 Championship management system for tracking race results, driver & constructor standings, and managing multi-season championships. Features a public-facing dashboard for viewers and a protected admin panel for championship organizers.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Public Dashboard](#public-dashboard)
  - [Admin Dashboard](#admin-dashboard)
  - [Authentication](#authentication)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Points System](#points-system)
- [Performance](#performance)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) with React 19 & TypeScript |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | Shadcn/ui (Radix UI primitives) |
| **Charts** | Recharts, Chart.js (with Sankey plugin) |
| **Tables** | TanStack React Table v8 |
| **Drag & Drop** | @dnd-kit |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (email/password) |
| **Deployment** | Vercel |
| **Icons** | Tabler Icons, Lucide React |
| **Notifications** | Sonner (toasts) |
| **Theming** | next-themes (dark/light mode) |

## Features

### Public Dashboard

- **Home Page** — Dashboard overview with key stats, a live countdown timer to the next race, and a confetti celebration animation when a season is finalized
- **Driver Standings** — Full championship table with points progression line charts, ranking evolution over the season, and points distribution breakdowns
- **Constructor Standings** — Team championship table with team color coding, aggregated statistics, and visual breakdowns
- **Race Results** — Browse past race results by track, including qualifying grids, finishing positions, and points awarded
- **Driver Stats** — Individual driver statistics including wins, podiums, pole positions, DNFs, and points finishes
- **Constructor Stats** — Team performance breakdowns and constructor comparisons
- **Driver Profiles** — Dedicated pages for each driver with career stats, race history, and team info
- **Season Selector** — Switch between seasons to view historical standings (persists across navigation via session storage)
- **Keyboard Shortcuts** — `Ctrl+Shift+D` to navigate to the admin dashboard

### Admin Dashboard

- **Race Results Management** — Create and update race results with drag-to-reorder finishing positions, toggle pole position / fastest lap / DNF flags per driver
- **Qualifying Management** — Record qualifying positions with drag-and-drop reordering
- **Driver Management** — Full CRUD for drivers: name, number (1–99), team assignment, driver image upload via Supabase Storage. Validates max 3 drivers per team and unique driver numbers
- **Team Management** — Create and edit constructors, view team rosters, manage logos and car images
- **Track Management** — Add tracks with name, images, and background imagery; select tracks for the current season; designate tracks as Race or Sprint
- **Schedule Management** — Build the race calendar by assigning dates to tracks
- **Settings** — Toggle championship rules: bonus point for pole position, bonus point for fastest lap
- **Season Lifecycle** — Finalize a season (computes winners), auto-create the next season with driver snapshots

### Authentication

- Email/password login and signup with Supabase Auth
- Server-side session management via middleware
- Admin routes protected with automatic redirect to login
- Post-login redirect back to the originally requested page
- Client-side auth guard component with loading state
- Account management page for user profile

## Data Models

| Model | Description |
|-------|-------------|
| **Driver** | Name, number (1–99), team FK, points, image |
| **Team** | Name, points (sum of drivers), logo, car image |
| **Track** | Name, image, background |
| **SelectedTrack** | Tracks included in a season, typed as Race or Sprint |
| **Schedule** | Race calendar: track + date |
| **Result** | Finishing position, pole, fastest lap, DNF per driver per track |
| **Qualifying** | Grid position per driver per track |
| **Rules** | Championship rule toggles (pole bonus, fastest lap bonus) |
| **Season** | Season number, finalized state, winning driver & constructor |

## API Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/drivers` | GET, POST, PUT, DELETE | Driver CRUD |
| `/api/teams` | GET, POST, PUT, DELETE | Team CRUD |
| `/api/tracks` | GET, POST | Track management |
| `/api/selected-tracks` | GET | Tracks in current season |
| `/api/schedules` | GET, POST | Race schedule management |
| `/api/results` | GET, POST, PUT | Race results management |
| `/api/qualifying` | GET, POST | Qualifying results |
| `/api/rules` | GET, POST | Championship rules config |
| `/api/seasons` | GET, POST, DELETE | Multi-season management |
| `/api/season-manager` | GET | Season selection for public dashboard |
| `/api/driver-stats` | GET | Aggregated championship data for standings & stats |
| `/api/cache-stats` | GET, DELETE | Cache monitoring & clearing |

## Points System

**Race Points** (Top 10):

| P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 |
|----|----|----|----|----|----|----|----|----|-----|
| 25 | 18 | 15 | 12 | 10 | 8  | 6  | 4  | 2  | 1   |

**Sprint Points** (Top 8):

| P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|----|----|----|----|----|----|----|----|
| 8  | 7  | 6  | 5  | 4  | 3  | 2  | 1  |

**Bonus Points** (configurable via Settings):
- +1 for pole position
- +1 for fastest lap

## Performance

- **Parallel data fetching** — `Promise.all()` for simultaneous database queries in stats endpoints
- **TTL memory cache** — App-level cache with 50MB limit, 1000 entries max, LRU eviction, stale-while-revalidate support, and automatic expired entry cleanup every 5 minutes
- **Browser cache headers** — Applied to API responses for client-side caching
- **Selective client rendering** — Strategic use of `"use client"` only for interactive components while keeping server rendering where possible
