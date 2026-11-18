# GAWA

React + Next.js + Tailwind CSS project.

## Development Server

To start the development server:
```sh
pnpm dev
```
By default, Next.js runs on `http://localhost:3000`.

## Project Structure

- `src/app/layout.tsx` - Root layout; imports `src/index.css` and sets document metadata
- `src/app/page.tsx` - Main page entrypoint rendering `<App />`
- `src/App.tsx` - Primary application component and UI view
- `src/data.ts` - Data definitions and prototypes
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 imports
- `package.json` - Project dependencies and scripts (`dev`, `build`, `start`, `format`)
- `next.config.mjs` - Next.js configuration
- `postcss.config.mjs` - PostCSS configuration with `@tailwindcss/postcss`

## Dependencies

- Runtime: React 19, React DOM 19, Next.js 16
- Styling: Tailwind CSS v4 with `@tailwindcss/postcss`
- TypeScript 5.7

## Styling

This project uses **Tailwind CSS v4** via `@tailwindcss/postcss` configured in `postcss.config.mjs`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. All utility classes and theme customizations from `src/index.css` are preserved.

## Database & MCP Guidelines

- **Primary Database Server**: Always use the **`gawa-db`** MCP server for all database operations, queries, and schema inspections in this project.
- **Do not use** the `supabase` MCP server for this project, as `gawa-db` is connected to this project's dedicated database (`hzualfogqsplrvhhzrnv`).

