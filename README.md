# Minuteserv Backend API

Complete backend implementation for Minuteserv booking and payment system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Create database tables in Supabase:
   - Open Supabase SQL Editor
   - Run `src/config/database.sql`

4. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/send-otp` - Send OTP
- `POST /api/v1/auth/verify-otp` - Verify OTP and login
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `GET /api/v1/auth/me` - Get current user (protected)
- `POST /api/v1/auth/logout` - Logout (protected)

## Health Check

- `GET /health` - Server health status

## Environment Variables

See `.env.example` for required variables.

## Project Structure

```
minuteservbackend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── server.js            # Main entry point
└── package.json
```

## Development

```bash
npm run dev  # Start with nodemon (auto-reload)
```

## Production

```bash
npm start    # Start production server
```

## License

ISC
