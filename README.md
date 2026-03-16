# PaceTracker

A daily performance metrics app built as a companion to the **6 Daily Metrics** book system.

## The 6 Core Metrics

| Metric | Description |
|--------|-------------|
| **TIME** | Intentional time management |
| **GOAL** | Primary goal pursuit |
| **TEAM** | Positive team contribution |
| **TASK** | Key task completion |
| **VIEW** | Vision and perspective clarity |
| **PACE** | Rhythm and pace maintenance |

## Scoring System

- **Success** = +1 point
- **Setback** = -1 point  
- **Skip** = 0 points (neutral)
- **Max score per day** = 6 points (10 with all custom metrics)
- Users can add up to **4 custom metrics** (exercise, nutrition, reading, etc.)

## Features

- User authentication (register/login)
- Daily scoring interface — rate all 6 core metrics + up to 4 custom
- Performance dashboard with filterable views (week/month/30d/year)
- Score history with breakdown per metric
- Daily notes
- Light/dark mode
- Daily schedule configuration

## Demo Login

```
Email:    demo@pacetracker.app
Password: demo1234
```

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + in-memory storage
- **Charts**: Recharts
- **Auth**: Session-based with scrypt password hashing

## Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5000

## Deployment (Render.com)

1. Connect this GitHub repository to Render
2. Create a **Web Service** with:
   - Build Command: `npm install && npm run build`
   - Start Command: `NODE_ENV=production node dist/index.cjs`
3. Set environment variable `SESSION_SECRET` to a random string

---

*Built with [Perplexity Computer](https://www.perplexity.ai/computer)*
