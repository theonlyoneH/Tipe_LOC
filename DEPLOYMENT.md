# 🚀 TIPE Deployment Guide

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ or higher
- npm, yarn, or pnpm package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd tipe

# Install dependencies
npm install
# or
pnpm install
# or
yarn install

# Start development server
npm run dev
# or
pnpm dev
# or  
yarn dev
```

The application will be available at `http://localhost:5173`

---

## 🏗 Build for Production

```bash
# Build the application
npm run build

# Preview the production build locally
npm run preview
```

The build output will be in the `/dist` directory.

---

## 🌐 Deployment Options

### 1. Vercel (Recommended)

Vercel provides seamless deployment for Vite/React applications.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

**Or use Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Vercel auto-detects Vite configuration
4. Click "Deploy"

### 2. Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

**Or use Netlify Dashboard:**
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `/dist` folder
3. Or connect your Git repository

### 3. GitHub Pages

Add to `package.json`:
```json
{
  "homepage": "https://yourusername.github.io/tipe"
}
```

Install gh-pages:
```bash
npm install --save-dev gh-pages
```

Add scripts to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

Deploy:
```bash
npm run deploy
```

### 4. AWS S3 + CloudFront

```bash
# Build the application
npm run build

# Upload to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 5. Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:
```bash
docker build -t tipe-app .
docker run -p 8080:80 tipe-app
```

---

## 🔧 Environment Configuration

### Environment Variables

Create `.env` file for environment-specific settings:

```env
# API Configuration (when connecting to real backend)
VITE_API_BASE_URL=https://api.tipe.ai
VITE_API_KEY=your_api_key_here

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_AI_FEATURES=true

# External Services
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

---

## 🔗 Backend Integration

### Connecting to Real Backend

Update `/src/app/lib/mockAPI.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = {
  async getLeads(): Promise<Lead[]> {
    const response = await fetch(`${API_BASE_URL}/api/leads`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },
  
  async updateLeadStatus(leadId: string, status: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/leads/${leadId}/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
  },
  
  // Add more API methods...
};
```

---

## 🎯 Performance Optimization

### 1. Code Splitting
Already implemented with React Router lazy loading.

### 2. Asset Optimization

Update `vite.config.ts`:
```typescript
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'charts': ['recharts'],
          'motion': ['motion'],
        },
      },
    },
  },
};
```

### 3. Image Optimization
- Use WebP format
- Implement lazy loading
- Use CDN for images

### 4. Caching Strategy

Add to `public/_headers` (Netlify):
```
/static/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable
```

---

## 📊 Analytics Integration

### Google Analytics

```typescript
// src/lib/analytics.ts
export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    window.gtag('config', 'GA_MEASUREMENT_ID');
  }
};

export const trackEvent = (action: string, category: string, label?: string) => {
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
  });
};
```

---

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Use backend proxy for sensitive keys
3. **HTTPS**: Always use HTTPS in production
4. **CORS**: Configure proper CORS policies
5. **CSP**: Implement Content Security Policy headers

---

## 🐛 Debugging Production Issues

### Enable Source Maps

In `vite.config.ts`:
```typescript
export default {
  build: {
    sourcemap: true,
  },
};
```

### Error Tracking

Integrate Sentry:
```bash
npm install @sentry/react
```

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: import.meta.env.MODE,
});
```

---

## 📱 Mobile Deployment

### Progressive Web App (PWA)

Install plugin:
```bash
npm install vite-plugin-pwa -D
```

Update `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TIPE - Trade Intent Prediction Engine',
        short_name: 'TIPE',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
};
```

---

## 🧪 Testing Before Deployment

```bash
# Run linting
npm run lint

# Type check
npm run type-check

# Build test
npm run build

# Preview production build
npm run preview
```

---

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] API endpoints updated
- [ ] Analytics integrated
- [ ] Error tracking setup
- [ ] Assets optimized
- [ ] Performance tested
- [ ] Security headers configured
- [ ] HTTPS enabled
- [ ] Domain configured
- [ ] Monitoring setup
- [ ] Backup strategy in place

---

## 🎉 Post-Deployment

### Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error alerts
- Monitor performance metrics

### Continuous Deployment
Set up CI/CD pipeline with:
- GitHub Actions
- GitLab CI
- CircleCI

Example GitHub Action:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 💡 Tips for Hackathon Deployment

1. **Use Vercel/Netlify**: Fastest deployment for demo
2. **Custom Domain**: Use a custom domain for professionalism
3. **SSL Certificate**: Ensure HTTPS is enabled
4. **Loading States**: Make sure all loading states work
5. **Error Handling**: Handle network errors gracefully
6. **Mobile Responsive**: Test on mobile devices
7. **Demo Data**: Ensure mock data is impressive
8. **Performance**: Optimize for fast load times

---

**Need Help?** Check the README.md for more details or raise an issue.

Good luck with your hackathon! 🚀
