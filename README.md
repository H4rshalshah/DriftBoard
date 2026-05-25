# DriftBoard - Live API Contract Drift Detection Platform

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Node-20+-green.svg" alt="Node">
  <img src="https://img.shields.io/badge/TypeScript-5.3-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

<p align="center">
  <strong>DriftBoard</strong> is a production-grade developer tool for real-time API contract drift detection.
</p>

---

## Problem We Solve

In large teams, backend APIs change frequently, causing frontend applications to break silently. DriftBoard detects these schema changes automatically in real time and visualizes them beautifully.

**Example:**
```json
// Old response
{ "userName": "Harshal" }

// New response
{ "username": "Harshal" }
```

Frontend breaks because nobody noticed the API contract changed. DriftBoard prevents this.

---

## Features

### Core Features
- **API Monitoring** - SDK intercepts requests/responses and extracts JSON schemas
- **Drift Detection Engine** - Detects added, removed, renamed, and type-changed fields
- **Real-time Notifications** - Slack, Discord, Email alerts when drift occurs
- **Version History** - Full schema snapshot timeline with diff comparison
- **Live Dashboard** - Beautiful real-time UI with WebSocket updates

### Security & Performance
- JWT Authentication with refresh tokens
- RBAC (Role-Based Access Control)
- Rate limiting and input sanitization
- API key management
- Helmet security headers

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DriftBoard Stack                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Frontend   │      │    SDK       │      │   Backend    │  │
│  │   (React)    │      │ (@driftboard)│      │   (Node.js)  │  │
│  │   Port 3000  │      │  Express     │      │   Port 5000  │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                     │          │
│         └─────────────────────┼─────────────────────┘          │
│                               │                                  │
│                    ┌──────────┴──────────┐                      │
│                    │     Nginx Proxy     │                      │
│                    │       Port 80       │                      │
│                    └──────────┬──────────┘                      │
│                               │                                  │
│         ┌─────────────────────┼─────────────────────┐           │
│         │                     │                     │           │
│  ┌──────┴───────┐      ┌──────┴───────┐      ┌──────┴───────┐  │
│  │   MongoDB    │      │    Redis     │      │  Socket.io   │  │
│  │   Port 27017│      │   Port 6379   │      │   Cluster    │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
driftboard/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── config/            # Configuration (database, redis, etc.)
│   │   ├── middleware/        # Express middleware (auth, validation, etc.)
│   │   ├── models/            # MongoDB schemas (User, Team, Project, etc.)
│   │   ├── routes/            # API routes (REST endpoints)
│   │   ├── services/          # Business logic (drift detection, auth, etc.)
│   │   ├── socket/            # Socket.io handlers for real-time
│   │   ├── types/             # TypeScript interfaces
│   │   ├── utils/             # Utilities (logger, helpers)
│   │   ├── workers/           # Background job processors
│   │   └── index.ts           # Main entry point
│   ├── tests/                 # Unit and integration tests
│   ├── Docker/                # Docker configuration
│   └── package.json
│
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── common/       # Shared UI components
│   │   │   ├── dashboard/    # Dashboard-specific components
│   │   │   └── layout/       # Layout components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services (axios, socket)
│   │   ├── store/             # Zustand state management
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utility functions
│   ├── public/                # Static assets
│   └── package.json
│
├── sdk/                       # @driftboard/sdk npm package
│   ├── src/
│   │   ├── lib/               # Core libraries (extractor, batcher, queue)
│   │   ├── middleware/        # Express middleware
│   │   ├── types/             # SDK types
│   │   └── utils/             # Utility functions
│   └── package.json
│
├── docker-compose.yml         # Docker Compose configuration
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for containers)
- MongoDB & Redis (if running locally)

### 1. Clone the Repository
```bash
git clone https://github.com/H4rshalshah/DriftBoard.git
cd driftboard
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Using Docker (Recommended)
```bash
docker-compose up -d
```

Access the application at `http://localhost`

---

## Backend API

### Authentication
```
POST /api/v1/auth/register     - Register new user
POST /api/v1/auth/login        - Login
POST /api/v1/auth/refresh      - Refresh access token
POST /api/v1/auth/logout       - Logout
```

### Projects
```
POST   /api/v1/projects        - Create project
GET    /api/v1/projects        - List projects
GET    /api/v1/projects/:id    - Get project
PATCH  /api/v1/projects/:id     - Update project
DELETE /api/v1/projects/:id     - Delete project
```

### Endpoints
```
POST   /api/v1/endpoints        - Create endpoint
GET    /api/v1/endpoints       - List endpoints
POST   /api/v1/endpoints/:id/schema - Submit schema (SDK call)
```

### Drift
```
GET    /api/v1/drift            - List drift events
PATCH  /api/v1/drift/:id/acknowledge - Acknowledge drift
```

For full API documentation, see `backend/src/routes/`.

---

## SDK Usage

### Installation
```bash
npm install @driftboard/sdk
```

### Express Integration
```javascript
const driftboard = require('@driftboard/sdk');
const express = require('express');

const app = express();

app.use(driftboard({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  debug: true
}));

// Your routes
app.get('/api/users', (req, res) => {
  res.json({ username: 'Harshal', age: 25 });
});

app.listen(3000);
```

### Configuration Options
```typescript
{
  apiKey: string;              // Required: Your DriftBoard API key
  endpoint?: string;           // Default: https://api.driftboard.io
  projectId?: string;          // Project identifier
  flushInterval?: number;     // Default: 5000ms
  maxQueueSize?: number;       // Default: 100
  sampleRate?: number;         // 0-1, default 1 (100%)
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  excludePaths?: string[];     // Paths to skip
  debug?: boolean;
}
```

---

## Drift Detection Algorithm

The drift detection engine compares JSON schemas recursively:

```typescript
interface SchemaComparison {
  hasDrift: boolean;
  severity: 'low' | 'medium' | 'breaking';
  score: number;              // 0-100
  changes: Change[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    renamed: number;
  };
}
```

### Change Types
- `ADDED` - New field in response
- `REMOVED` - Field removed from response
- `MODIFIED` - Field value changed
- `RENAMED` - Field name changed (detected via Levenshtein distance)
- `TYPE_CHANGED` - Field type changed (string → number)

### Severity Calculation
- **Breaking (80-100)**: Removed fields, type changes
- **Medium (40-79)**: Important field modifications
- **Low (0-39)**: New fields added

---

## WebSocket Events

Connect to real-time updates:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: 'your-jwt-token' }
});

// Subscribe to project updates
socket.emit('project:subscribe', { projectId: 'xxx' });

// Listen for drift events
socket.on('drift:detected', (drift) => {
  console.log('New drift detected!', drift);
});
```

### Events
- `drift:detected` - New drift event
- `endpoint:update` - Endpoint schema updated
- `notification:new` - New notification

---

## Database Models

### User
```javascript
{
  email: String,           // Unique, indexed
  passwordHash: String,
  name: String,
  role: 'admin' | 'owner' | 'member' | 'viewer',
  teamIds: [ObjectId],
  refreshToken: String
}
```

### Project
```javascript
{
  name: String,
  slug: String,            // Unique per team
  teamId: ObjectId,
  settings: {
    retentionDays: Number,
    autoRemediate: Boolean
  }
}
```

### Endpoint
```javascript
{
  path: String,            // Indexed
  method: String,
  projectId: ObjectId,
  currentSchema: Object,
  deprecated: Boolean
}
```

### SchemaSnapshot
```javascript
{
  endpointId: ObjectId,
  schema: Object,
  version: Number,
  metadata: {
    size: Number,
    fieldCount: Number,
    depth: Number
  }
}
```

### DriftEvent
```javascript
{
  endpointId: ObjectId,
  projectId: ObjectId,
  severity: 'low' | 'medium' | 'breaking',
  changes: [{
    type: String,
    path: String,
    oldValue: Mixed,
    newValue: Mixed
  }],
  detectedAt: Date
}
```

---

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/driftboard
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SOCKET_PORT=5001
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Deployment

### Docker (Recommended)
```bash
# Production
docker-compose -f docker-compose.yml up -d

# With custom environment
docker-compose -f docker-compose.yml up -d --env-file .env.production
```

### Manual Deployment

**Backend:**
```bash
cd backend
npm install
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run build
# Serve with nginx or Vercel
```

### Cloud Platforms
- **Frontend**: Vercel, Netlify
- **Backend**: Render, Railway, AWS Elastic Beanstalk
- **Database**: MongoDB Atlas
- **Cache**: Redis Cloud

---

## Testing

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
```

### SDK Tests
```bash
cd sdk
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Support

- Documentation: See the setup, API, SDK, and deployment sections in this README.
- Issues: [GitHub Issues](https://github.com/H4rshalshah/Driftboard/issues)
- Email: h4rshal.workspace@gmail.com

---

<p align="center">
  Built with ❤️ by H4rshal, for developers.
</p>
