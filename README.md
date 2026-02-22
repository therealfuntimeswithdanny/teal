# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### Deploy with Vercel

This repo is configured for Vercel (see `vercel.json`):

- Build command: `npm run build`
- Output directory: `dist`
- SPA route fallback rewrite to `index.html`

Steps:

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. Keep the detected framework as **Vite**.
4. Add any required environment variables:
   - `VITE_APP_ORIGIN` (for example: `https://teal-stats.madebydanny.uk`)
   - `VITE_ATPROTO_OAUTH_ORIGIN` (for example: `https://your-project-name.vercel.app`)
   - `VITE_ATPROTO_CLIENT_ID` (for example: `https://your-project-name.vercel.app/oauth/client-metadata.json`)
   - `VITE_ATPROTO_REDIRECT_URI` (for example: `https://your-project-name.vercel.app/oauth/callback`)
   - `VITE_ATPROTO_HANDLE_RESOLVER` (default: `https://bsky.social`)
   - `VITE_ATPROTO_ALLOWED_RETURN_ORIGINS` (comma-separated origins allowed after OAuth callback)
   - `VITE_LASTFM_API_KEY` (optional; only needed for Last.fm art fallback)
5. Deploy.

### AT Protocol OAuth setup

OAuth metadata is generated at build time (`npm run oauth:metadata` / `prebuild`).

For this setup:

- App domain: `https://teal-stats.madebydanny.uk`
- OAuth domain: `https://your-project-name.vercel.app`
- Client metadata URL: `https://your-project-name.vercel.app/oauth/client-metadata.json`
- Callback URL: `https://your-project-name.vercel.app/oauth/callback`
- Metadata `client_uri` must be on the same origin as `client_id` (AT Protocol requirement). The generator now sets both to the OAuth origin.

Note: browser OAuth session storage is origin-scoped. With this bridge setup,
the persisted OAuth session is stored on the OAuth origin (`*.vercel.app`),
then the user is redirected back to the app origin (`teal-stats.madebydanny.uk`).

Make sure both paths are reachable after deploy (they are provided by:

- `public/oauth/client-metadata.json`
- the React routes `/oauth/start` and `/oauth/callback`)

If you still see this OAuth error:

- `invalid_request`
- `Forbidden sec-fetch-site header "same-site"`

your app origin is considered "same-site" with the auth server/PDS. This is
rejected by the server. Using a Vercel domain for OAuth with your app hosted on
`teal-stats.madebydanny.uk` avoids that by making the OAuth requests cross-site.

### Deploy with Lovable

Open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
