# 🏗 TIPE - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         TIPE Platform                            │
│                  Trade Intent Prediction Engine                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
        ┌───────▼────────┐            ┌────────▼────────┐
        │   Frontend      │            │    Backend      │
        │   React App     │◄──────────►│   (Mock/Real)   │
        └────────────────┘            └─────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.tsx (Root)
├── RouterProvider (React Router)
│   └── Layout.tsx
│       ├── Sidebar Navigation
│       │   ├── Logo
│       │   ├── Nav Items (8)
│       │   └── Logout
│       │
│       └── Outlet (Page Content)
│           ├── Dashboard.tsx
│           │   ├── KPICard × 4
│           │   ├── Pipeline Chart
│           │   ├── Channel Performance
│           │   └── Activity Feed
│           │
│           ├── ApproveLeads.tsx ⭐
│           │   ├── Progress Bar
│           │   ├── SwipeCard Stack
│           │   │   └── SwipeCard.tsx
│           │   │       ├── Company Info
│           │   │       ├── AI Scores
│           │   │       ├── Trust Badge
│           │   │       └── Swipe Handlers
│           │   └── Action Stats
│           │
│           ├── ApprovedLeads.tsx
│           │   ├── Search Bar
│           │   └── Lead Grid
│           │       └── Lead Cards
│           │
│           ├── Conversations.tsx
│           │   ├── Conversation List
│           │   ├── Chat Window
│           │   │   ├── Message Bubbles
│           │   │   └── Input Box
│           │   └── AI Status Panel
│           │
│           ├── Meetings.tsx
│           │   ├── Stats Cards
│           │   ├── Upcoming Section
│           │   └── Past Section
│           │
│           ├── Analytics.tsx
│           │   ├── Metric Cards
│           │   ├── ICP Distribution (Pie)
│           │   ├── Channel Performance (Bar)
│           │   ├── Trends (Line)
│           │   └── Top Segments (List)
│           │
│           ├── ContentEngine.tsx
│           │   ├── AI Suggestions
│           │   ├── Published Posts
│           │   ├── Scheduled Posts
│           │   └── Drafts
│           │
│           └── Profile.tsx
│               ├── Profile Card
│               ├── Preferences
│               └── Security
│
└── QueryClientProvider (TanStack Query)
    └── Toaster (Sonner)
```

## State Management Architecture

### Zustand Store Structure

```typescript
Store
├── State
│   ├── leads: Lead[]                    // All leads
│   ├── approvedLeads: Lead[]            // Filtered approved
│   ├── conversations: Conversation[]     // Active chats
│   ├── messages: Record<id, Message[]>   // Chat history
│   ├── meetings: Meeting[]              // Calendar
│   ├── contentPosts: ContentPost[]      // LinkedIn content
│   └── stats: Stats                     // Computed KPIs
│
└── Actions
    ├── setLeads()                       // Initialize leads
    ├── updateLeadStatus()               // Swipe action
    ├── addConversation()                // New chat
    ├── addMessage()                     // Send message
    ├── toggleAIHandling()               // AI on/off
    ├── addMeeting()                     // Schedule
    ├── updateMeetingStatus()            // Complete
    ├── addContentPost()                 // Create post
    ├── updateContentPost()              // Edit post
    └── updateStats()                    // Recalculate KPIs
```

## Data Flow

### Lead Approval Flow

```
1. User opens /approve page
        │
        ▼
2. useStore fetches pending leads
        │
        ▼
3. Leads sorted by ranking
   (vector_score + intent_score + momentum) / 3
        │
        ▼
4. Display top 3 cards in stack
        │
        ▼
5. User swipes card
   ├── Right → Approve
   ├── Left  → Reject
   └── Up    → Skip
        │
        ▼
6. Optimistic UI update (instant)
        │
        ▼
7. Send action to backend (mock API)
        │
        ▼
8. Update Zustand store
        │
        ▼
9. Re-render with next card
        │
        ▼
10. Update stats (computed)
```

### AI Conversation Flow

```
1. Lead approved
        │
        ▼
2. Auto-create conversation
        │
        ▼
3. AI drafts initial message
   (uses outreach_template)
        │
        ▼
4. Send via channel (Email/LinkedIn/etc.)
        │
        ▼
5. Lead responds
        │
        ▼
6. AI analyzes response
   ├── Sentiment
   ├── Intent
   └── Next action
        │
        ▼
7. AI generates reply OR
   Alert user for manual takeover
        │
        ▼
8. Conversation progresses
        │
        ▼
9. Meeting suggested when ready
```

## Animation System

### Motion (Framer Motion) Integration

```
Gesture Handling
├── useMotionValue(x, y)        // Track drag position
├── useTransform()              // Map values to animations
│   ├── rotateZ: x → [-20, 20]  // Card rotation
│   ├── opacity: x → [0.5, 1]   // Fade on edges
│   ├── approveOpacity: x → [0, 1]  // Show approve stamp
│   └── rejectOpacity: x → [1, 0]   // Show reject stamp
│
├── handleDragEnd()             // Swipe detection
│   ├── Check threshold (150px)
│   ├── Check velocity (>500px/s)
│   └── Trigger onSwipe callback
│
└── Exit Animations
    ├── x: ±1000px              // Fly off screen
    ├── y: -1000px (skip)       // Fly up
    ├── rotate: ±30deg          // Spin out
    └── opacity: 0              // Fade out
```

### Page Transitions

```
Motion Components
├── Initial State
│   ├── opacity: 0
│   ├── y: 20px
│   └── scale: 0.95
│
├── Animate State
│   ├── opacity: 1
│   ├── y: 0
│   └── scale: 1
│
├── Transition Config
│   ├── duration: 0.3s
│   ├── ease: "easeOut"
│   └── stagger: 0.05s per item
│
└── Hover Effects
    ├── scale: 1.02
    ├── translateY: -4px
    └── shadow: xl
```

## API Integration Layer

### Mock API Structure

```typescript
mockAPI
├── getLeads()
│   ├── Generate 50 leads
│   ├── Calculate scores
│   ├── Sort by ranking
│   └── Return: Lead[]
│
├── updateLeadStatus(id, status)
│   ├── Simulate network delay
│   ├── Log action
│   └── Return: void
│
├── getConversations()
│   ├── Generate 3 conversations
│   └── Return: Conversation[]
│
├── getMessages(conversationId)
│   ├── Retrieve chat history
│   └── Return: Message[]
│
├── sendMessage(convId, content)
│   ├── Create message object
│   ├── Add timestamp
│   └── Return: Message
│
├── getMeetings()
│   ├── Generate upcoming + past
│   └── Return: Meeting[]
│
└── getContentPosts()
    ├── Generate drafts, scheduled, published
    └── Return: ContentPost[]
```

### Real API Integration (Future)

```typescript
API Endpoints
├── Auth
│   ├── POST /auth/login
│   ├── POST /auth/logout
│   └── POST /auth/refresh
│
├── Leads
│   ├── GET    /api/leads
│   ├── GET    /api/leads/:id
│   ├── POST   /api/leads/:id/status
│   └── PATCH  /api/leads/:id
│
├── Conversations
│   ├── GET    /api/conversations
│   ├── GET    /api/conversations/:id/messages
│   ├── POST   /api/conversations/:id/messages
│   └── PATCH  /api/conversations/:id/ai-toggle
│
├── Meetings
│   ├── GET    /api/meetings
│   ├── POST   /api/meetings
│   ├── PATCH  /api/meetings/:id
│   └── DELETE /api/meetings/:id
│
├── Content
│   ├── GET    /api/content
│   ├── POST   /api/content
│   ├── PATCH  /api/content/:id
│   └── DELETE /api/content/:id
│
└── Analytics
    ├── GET /api/analytics/overview
    ├── GET /api/analytics/channels
    └── GET /api/analytics/trends
```

## Backend Architecture (Future)

### Microservices Design

```
┌─────────────────────────────────────────────────────┐
│                  API Gateway                         │
│              (Authentication, Rate Limiting)         │
└───────┬──────────────┬──────────────┬──────────────┘
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
   │  Lead   │   │  Chat     │  │ Content │
   │ Service │   │  Service  │  │ Service │
   └────┬────┘   └─────┬─────┘  └────┬────┘
        │              │              │
   ┌────▼─────────────▼──────────────▼────┐
   │           Message Queue                │
   │         (RabbitMQ / Kafka)            │
   └────┬──────────────┬──────────────┬────┘
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
   │   AI    │   │  Vector   │  │  Block- │
   │ Ranking │   │  Database │  │  chain  │
   │ Service │   │  (Pinecone)│  │ Service │
   └─────────┘   └───────────┘  └─────────┘
```

### Database Schema

```sql
-- Leads Table
leads
├── id (UUID, PK)
├── company_name (VARCHAR)
├── industry (VARCHAR)
├── location (VARCHAR)
├── vector_embedding (VECTOR)     -- For similarity search
├── intent_score (FLOAT)
├── momentum_index (FLOAT)
├── match_percentage (INT)
├── trust_verified (BOOLEAN)
├── firmographics_hash (VARCHAR)
└── created_at (TIMESTAMP)

-- Conversations Table
conversations
├── id (UUID, PK)
├── lead_id (UUID, FK → leads.id)
├── channel (ENUM: email, linkedin, whatsapp, call)
├── ai_handling (BOOLEAN)
├── status (ENUM: active, archived)
└── created_at (TIMESTAMP)

-- Messages Table
messages
├── id (UUID, PK)
├── conversation_id (UUID, FK → conversations.id)
├── sender (ENUM: user, lead, ai)
├── content (TEXT)
├── channel (ENUM)
└── created_at (TIMESTAMP)

-- Meetings Table
meetings
├── id (UUID, PK)
├── lead_id (UUID, FK → leads.id)
├── title (VARCHAR)
├── date (TIMESTAMP)
├── duration (INT)
├── status (ENUM: scheduled, completed, cancelled)
├── ai_summary (TEXT)
└── follow_up_sent (BOOLEAN)
```

## ML Pipeline (Future)

### Vector Similarity Engine

```
Input: Company Data
├── Products/Services
├── Target Markets
├── Company Size
├── Industry Tags
└── Geographic Data
        │
        ▼
Text Preprocessing
├── Tokenization
├── Normalization
└── Stop word removal
        │
        ▼
Embedding Generation
├── Model: sentence-transformers
├── Dimension: 768
└── Output: Vector embedding
        │
        ▼
Vector Database (Pinecone)
├── Store embeddings
├── Index for fast search
└── Similarity search (cosine)
        │
        ▼
Ranking Algorithm
├── Vector similarity: 40%
├── Intent signals: 35%
├── Momentum index: 25%
└── Final score: 0.0 - 1.0
```

## Performance Optimization

### Frontend Optimizations

```
Code Splitting
├── Route-based splitting
├── Component lazy loading
└── Dynamic imports

Bundle Size
├── Tree shaking
├── Minification
├── Compression (gzip)
└── Target: <500KB total

Rendering
├── React.memo for expensive components
├── useMemo for computed values
├── useCallback for event handlers
└── Virtual scrolling for long lists

Caching
├── TanStack Query cache
├── Service Worker (PWA)
├── localStorage for preferences
└── IndexedDB for offline data
```

## Security Architecture

```
Frontend Security
├── HTTPS only
├── CSP headers
├── XSS prevention
├── CSRF tokens
└── Input sanitization

Backend Security
├── JWT authentication
├── Rate limiting
├── API key rotation
├── Data encryption at rest
└── Audit logging

Trust Layer
├── Blockchain verification
├── SHA-256 hashing
├── Digital signatures
└── Immutable records
```

## Monitoring & Analytics

```
Application Monitoring
├── Error tracking (Sentry)
├── Performance monitoring (Web Vitals)
├── User analytics (Google Analytics)
└── Custom events tracking

Infrastructure Monitoring
├── Uptime monitoring
├── API response times
├── Database performance
└── Server resource usage

Business Metrics
├── User engagement
├── Swipe patterns
├── Conversion rates
└── Feature adoption
```

## Deployment Pipeline

```
Development → Staging → Production

CI/CD Flow
├── Code push to Git
├── Run tests
├── Build application
├── Deploy to staging
├── Run E2E tests
├── Manual approval
├── Deploy to production
└── Health checks
```

---

## Technology Stack Summary

### Frontend
- **Framework**: React 18.3
- **Language**: TypeScript
- **Routing**: React Router v7
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **Animation**: Motion (Framer Motion)
- **Charts**: Recharts
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Build Tool**: Vite

### Backend (Future)
- **Runtime**: Node.js
- **Framework**: Express / Fastify
- **Database**: PostgreSQL
- **Vector DB**: Pinecone
- **Cache**: Redis
- **Queue**: RabbitMQ
- **AI/ML**: Python microservices
- **Blockchain**: Ethereum / Polygon

### DevOps
- **Hosting**: Vercel / Netlify
- **CDN**: Cloudflare
- **Monitoring**: Sentry
- **Analytics**: Google Analytics
- **CI/CD**: GitHub Actions

---

**Architecture Principles**

1. **Separation of Concerns**: Clear boundaries between UI, state, and data
2. **Scalability**: Designed to handle growth
3. **Maintainability**: Clean code, TypeScript, documentation
4. **Performance**: Optimistic updates, lazy loading, caching
5. **Security**: Defense in depth, encrypted, verified
6. **User Experience**: Smooth animations, instant feedback, intuitive

This architecture supports TIPE's mission: making B2B trade matching as simple as a swipe. 🚀
