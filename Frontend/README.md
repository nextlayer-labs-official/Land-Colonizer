# Land Colonizer AMS — Frontend

Next.js 16 + React 19 frontend for the Land Colonizer Asset Management System.

## Development

```bash
# Create env file
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local

npm install
npm run dev       # http://localhost:3000
```

## Production Build

```bash
npm run build
npm start         # or use PM2: pm2 start npm --name frontend -- start
```

See the root [`README.md`](../README.md) and [`AMS-Deployment-Guide.html`](../AMS-Deployment-Guide.html) for full setup instructions.
