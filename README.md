# 🚀 TIPE - Trade Intent Prediction Engine

## Overview

TIPE is an enterprise-grade AI-powered export matchmaking platform that transforms static trade listings into an adaptive, intent-driven, swipe-based global trade intelligence system. Built for hackathon excellence with a focus on innovation, user experience, and technical sophistication.

## ✨ Key Features

### 🎯 Core Innovation
- **AI-Powered Lead Ranking**: Vector similarity + Intent scoring + Trade momentum analysis
- **Tinder-Style Swipe Interface**: Revolutionary swipe gestures for B2B lead approval
- **Real-time Intelligence**: Optimistic UI updates with seamless backend synchronization
- **Trust Layer**: Blockchain-verified firmographics with SHA-256 hashing

### 📊 Complete Platform
1. **Dashboard**: KPI overview, pipeline visualization, channel performance
2. **Approve Leads**: Swipe-based lead approval with physics-based gestures
3. **Approved Leads**: Searchable lead database with quick actions
4. **Conversations**: Multi-channel AI-powered chat management
5. **Meetings**: Calendar integration with AI meeting summaries
6. **Analytics**: Deep insights with interactive charts (ICP distribution, trends, segments)
7. **Content Engine**: LinkedIn automation with AI-generated posts
8. **Profile**: User management and security settings

## 🛠 Tech Stack

### Frontend
- **React** with TypeScript
- **React Router** for navigation
- **Motion (Framer Motion)** for smooth animations
- **Zustand** for state management
- **TanStack Query** for data fetching
- **Recharts** for data visualization
- **Tailwind CSS v4** for styling
- **Lucide React** for icons

### Key Features
- Production-ready architecture
- Responsive design (desktop + mobile)
- Enterprise SaaS UI/UX
- Smooth page transitions
- Physics-based swipe gestures
- Skeleton loaders
- Optimistic UI updates
- Toast notifications

## 📁 Project Structure

```
/src
  /app
    /components
      - Layout.tsx              # Main layout with sidebar
      - SwipeCard.tsx           # Core swipe card component
      /ui                       # Reusable UI components
    /pages
      - Dashboard.tsx           # Overview & KPIs
      - ApproveLeads.tsx        # Swipe interface
      - ApprovedLeads.tsx       # Lead management
      - Conversations.tsx       # Multi-channel chat
      - Meetings.tsx            # Calendar & summaries
      - Analytics.tsx           # Charts & insights
      - ContentEngine.tsx       # LinkedIn automation
      - Profile.tsx             # Settings
    /store
      - useStore.ts             # Zustand state management
    /lib
      - mockAPI.ts              # Mock API with realistic data
    - routes.ts                 # Router configuration
    - App.tsx                   # Root component
  /styles
    - theme.css                 # Design tokens
    - tailwind.css              # Tailwind config
```

## 🎨 Design System

### Colors
- **Primary**: Deep blue gradient (#0f172a, #1e293b, #334155)
- **Accent**: Blue to cyan gradients
- **Status**: Green (approved), Red (rejected), Orange (scheduled)

### Components
- Rounded corners (rounded-xl, rounded-2xl)
- Soft shadows (shadow-lg, shadow-xl)
- Smooth transitions (300ms)
- Gradient backgrounds
- Glass morphism effects

## 🔥 Standout Features for Hackathon

1. **Tinder-Style Swipe Mechanics**
   - Velocity-based detection
   - Physics-based animations
   - Stacked card depth effect
   - Three-way swipe (left/right/up)

2. **AI Intelligence Layer**
   - Vector similarity scoring
   - Intent signal analysis
   - Trade momentum indexing
   - AI reasoning explanations

3. **Trust Verification**
   - Blockchain-verified badges
   - SHA-256 firmographic hashing
   - Abstract complexity from users

4. **Advanced Analytics**
   - ICP match distribution
   - Channel performance comparison
   - Trend analysis
   - Top performing segments

5. **Content Automation**
   - AI-generated LinkedIn posts
   - Engagement metrics
   - Scheduled publishing
   - Draft management

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## 📊 Mock Data

The application includes rich mock data:
- **50 AI-ranked leads** with vector scores
- **3 active conversations** with message history
- **3 meetings** (scheduled + completed)
- **3 LinkedIn posts** (draft + scheduled + published)
- **Analytics data** for charts and insights

## 🎯 Backend Integration

### API Endpoints Expected

```typescript
// Lead management
GET /api/leads - Fetch all leads
POST /api/leads/:id/status - Update lead status

// Conversations
GET /api/conversations - Fetch conversations
GET /api/conversations/:id/messages - Get messages
POST /api/conversations/:id/messages - Send message

// Meetings
GET /api/meetings - Fetch meetings
POST /api/meetings - Create meeting

// Content
GET /api/content - Fetch posts
POST /api/content - Create post
```

### Backend Response Format

```typescript
{
  id: string;
  company_name: string;
  industry: string;
  location: string;
  vector_score: number;        // 0.0 - 1.0
  intent_score: number;        // 0.0 - 1.0
  trade_momentum_index: number; // 0.0 - 1.0
  match_percentage: number;    // 60 - 100
  firmographics_hash: string;
  trust_verified: boolean;
  company_size: string;
  estimated_value: string;
  ai_reasoning: string;
  outreach_template: string;
}
```

## 🏆 Hackathon Pitch Points

1. **Innovation**: First Tinder-style B2B matchmaking platform
2. **AI Integration**: Multi-factor ranking algorithm
3. **UX Excellence**: Intuitive swipe gestures + enterprise polish
4. **Scalability**: Production-ready architecture
5. **Trust Layer**: Blockchain verification
6. **Full Platform**: Complete end-to-end solution
7. **Modern Stack**: Latest technologies (Motion, Zustand, TanStack)
8. **Attention to Detail**: Animations, loading states, error handling

## 🎬 Demo Flow

1. **Dashboard**: Show KPIs and pipeline overview
2. **Approve Leads**: Demonstrate swipe gestures
   - Swipe right to approve
   - Swipe left to reject
   - Swipe up to skip
3. **Approved Leads**: Browse approved matches
4. **Conversations**: Show AI handling conversations
5. **Analytics**: Display data insights
6. **Content Engine**: Demonstrate LinkedIn automation

## 📈 Future Enhancements

- Real-time notifications
- Video call integration
- Advanced filters and search
- CRM integration
- Mobile app (React Native)
- Multilingual support
- Advanced ML models
- Blockchain smart contracts

## 🤝 Contributing

This project is designed for hackathon demonstration. For production use, integrate with real backend APIs and implement proper authentication.

## 📄 License

MIT License - Built for hackathon demonstration

---

**Built with ❤️ for innovation in global trade**
