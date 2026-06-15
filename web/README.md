This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. Set up Supabase

1. Create a project at [Supabase](https://app.supabase.com)
2. Run the database migrations:
   - Go to your Supabase project → SQL Editor
   - Run `web/db/migrations/001_create_supabase_tables.sql`
   - Run `web/db/migrations/002_policies.sql`

### 2. Configure Environment Variables

Create a `.env.local` file in the `web` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
MAL_CLIENT_ID=your-mal-client-id
MAL_CLIENT_SECRET=your-mal-client-secret
MAL_REDIRECT_URI=http://localhost:3000/api/mal/callback
```

Get these values from your Supabase project settings: https://app.supabase.com/project/_/settings/api

### 3. Run the Development Server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Troubleshooting

### Vercel Deployment Blocked (Unrecognized Author)
If your deployment fails on Vercel due to an unrecognized commit author, ensure your Git email matches your GitHub account email:

```bash
git config user.email "your-email@example.com"
git commit --amend --reset-author --no-edit
git push origin master --force
```

Vercel may block builds from placeholder emails (like `example.com`) for security.
