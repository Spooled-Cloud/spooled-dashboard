# Getting Started

## Prerequisites

- Node.js 20+
- npm

## Installation

```bash
git clone https://github.com/spooled-cloud/spooled-dashboard.git
cd spooled-dashboard
npm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
PUBLIC_API_URL=http://localhost:3000
PUBLIC_WS_URL=ws://localhost:3000
```

## Development

```bash
npm run dev
```

Open http://localhost:4321

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests |
| `npm run lint` | Lint code |
| `npm run format` | Format code |

## Project Structure

```
src/
├── components/     # React components
├── layouts/        # Astro layouts
├── pages/          # Routes (file-based)
├── lib/            # API client, utilities
├── stores/         # Zustand state
└── styles/         # Global CSS
```

## Next Steps

- [API Integration](./API_INTEGRATION.md)
- [Deployment](./DEPLOYMENT.md)
- [Security](./SECURITY.md)
