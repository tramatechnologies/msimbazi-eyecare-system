# Setup Instructions - Msimbazi Eye Care Management System

## Prerequisites

- Node.js 18+ and npm
- Gemini API Key (for AI features)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   VITE_API_URL=http://localhost:3001
   ```

## Running the Application

### Option 1: Run Frontend Only (Development)
```bash
npm run dev
```
This runs the frontend on http://localhost:3000

**Note:** AI features will not work without the backend server.

### Option 2: Run Full Stack (Recommended)
```bash
npm run dev:all
```
This runs both:
- Frontend on http://localhost:3000
- Backend API server on http://localhost:3001

### Option 3: Run Separately

**Terminal 1 - Backend:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Default Login Credentials

The system uses mock authentication for development:

| Role | Email | Password |
|------|-------|----------|
| Receptionist | receptionist@msimbazi.com | reception123 |
| Optometrist | optometrist@msimbazi.com | optometrist123 |
| Pharmacist | pharmacist@msimbazi.com | pharmacist123 |
| Optical Dispenser | optical@msimbazi.com | optical123 |
| Billing Officer | billing@msimbazi.com | billing123 |
| Admin | admin@msimbazi.com | admin123 |
| Manager | manager@msimbazi.com | manager123 |

## Key Features Implemented

### ✅ Security Fixes
- API keys moved to backend (no client-side exposure)
- Input validation and sanitization
- Secure ID generation (UUID-based)
- Proper authentication system

### ✅ Data Persistence
- localStorage-based persistence
- Data survives page refreshes
- Export/import functionality

### ✅ State Management
- Context API for global state
- Centralized patient management
- No prop drilling

### ✅ Error Handling
- Error boundaries
- Toast notifications
- User-friendly error messages
- Retry logic for API calls

### ✅ Code Quality
- TypeScript strict typing
- Utility functions for common operations
- Validation utilities
- Debounced search

## Project Structure

```
├── components/          # Reusable UI components
│   ├── ErrorBoundary.tsx
│   ├── Layout.tsx
│   └── Toast.tsx
├── contexts/            # React Context providers
│   ├── AuthContext.tsx
│   └── PatientContext.tsx
├── services/            # API and external services
│   ├── geminiService.ts
│   └── storageService.ts
├── utils/               # Utility functions
│   ├── debounce.ts
│   ├── errorHandler.ts
│   ├── idGenerator.ts
│   ├── patientUtils.ts
│   └── validation.ts
├── views/               # Page components
│   ├── Billing.tsx
│   ├── Clinical.tsx
│   ├── Login.tsx
│   ├── OpticalDispensing.tsx
│   ├── Pharmacy.tsx
│   ├── Queue.tsx
│   └── Registration.tsx
├── server/              # Backend API server
│   └── api.js
└── App.tsx              # Root component
```

## Development Notes

### Data Storage
- Patient data is stored in browser localStorage
- Data persists across page refreshes
- To clear data: Open browser DevTools → Application → Local Storage → Clear

### API Proxy
- The backend server (`server/api.js`) handles AI API calls
- API keys are never exposed to the client
- Backend runs on port 3001 by default

### Testing
Currently, the application uses mock data and localStorage. For production:
- Replace localStorage with a real database
- Implement proper backend API
- Add authentication tokens (JWT)
- Add rate limiting and security headers

## Troubleshooting

### AI Features Not Working
1. Ensure backend server is running (`npm run dev:server`)
2. Check that `GEMINI_API_KEY` is set in `.env.local`
3. Verify backend is accessible at http://localhost:3001/health

### Data Not Persisting
1. Check browser localStorage is enabled
2. Clear browser cache and try again
3. Check browser console for errors

### Port Already in Use
- Change port in `vite.config.ts` (frontend) or `server/api.js` (backend)
- Or kill the process using the port:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  
  # Mac/Linux
  lsof -ti:3000 | xargs kill
  ```

## Next Steps for Production

1. **Backend Database:**
   - Replace localStorage with PostgreSQL/MongoDB
   - Implement proper API endpoints
   - Add database migrations

2. **Authentication:**
   - Implement JWT tokens
   - Add refresh token mechanism
   - Role-based access control (RBAC)

3. **Security:**
   - Add HTTPS/SSL
   - Implement CORS properly
   - Add rate limiting
   - Content Security Policy (CSP)

4. **Testing:**
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (Playwright/Cypress)

5. **Monitoring:**
   - Error tracking (Sentry)
   - Performance monitoring
   - Analytics

## Support

For issues or questions, refer to `ENGINEERING_REVIEW.md` for detailed technical documentation.
