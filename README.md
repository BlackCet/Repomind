# RepoMind AI

RepoMind AI is a developer tool for exploring GitHub repositories, viewing repository files, and generating AI-powered insights.

## Features

- Browse GitHub repositories and directory trees
- View raw repository file contents
- Use Gemini AI for repository analysis
- Proxy GitHub requests through the Express server
- Integrate with Render for service deployment
- Vite-powered development workflow

## Requirements

- Node.js 18 or later
- npm
- GitHub token for private repositories or higher API limits
- Gemini API key
- Render API key, if deployment features are used

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Environment variables

Create a local environment file:

```env
GEMINI_API_KEY=your_gemini_api_key
GITHUB_TOKEN=your_github_token
```

Do not commit `.env`, `.env.local`, or any file containing credentials.

## Run locally

Start the development server:

```bash
npm run dev
```

Open the application at:

<http://localhost:3000>

## Production build

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API routes

The Express server provides these proxy endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github/repo` | Fetch repository contents |
| `GET` | `/api/github/tree` | Fetch the repository Git tree |
| `GET` | `/api/github/raw` | Fetch raw file content |
| `GET` | `/api/render/owners` | List Render owners |
| `POST` | `/api/render/services` | Create a Render service |

GitHub routes accept `owner` and `repo` query parameters. Render routes require the `x-render-api-key` request header.

## Security

- Keep all API keys in environment variables.
- Never commit `.env` files or private keys.
- Rotate credentials immediately if they are exposed.
- Review files before pushing them to a public repository.

## Project structure

```text
.
├── server.ts          # Express server and API proxies
├── src/               # Frontend application
├── public/             # Static assets
├── .env.example        # Example environment variables
├── package.json
└── README.md
```

## License

Add the applicable project license here.