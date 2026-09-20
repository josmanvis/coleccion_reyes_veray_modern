This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

## Inventory

A local SQLite database (`data/inventory.db`, gitignored) holds the collection
records. It is the working copy of the collection spreadsheet, and the source
the public site can be fed from.

| Route | Purpose |
| --- | --- |
| `/inventory` | Searchable catalogue — table or gallery view, filters, CSV export |
| `/inventory/<registro>` | Full record for one work |
| `/admin` | Totals, data quality, spreadsheet import, JSON/CSV export |
| `/admin/artwork/<registro>` | Edit every field of one work |

Both areas sit behind a single password. Set `INVENTORY_PASSWORD` in
`.env.local` and restart the dev server; `src/proxy.ts` redirects everything
else to `/login`.

```bash
npm run inventory:seed              # load ../Backup_sept_20_12-23pm.xlsx
npm run inventory:seed -- --reset   # wipe the table first
npm run wp:fetch                    # snapshot coleccionreyesveray.com to data/wordpress/
```

Rows are matched on `# Registro`, so re-importing an updated spreadsheet
updates existing works and adds new ones without deleting anything. The
original spreadsheet cell values are also kept per row in `raw_json`.

Fields are declared once in `src/lib/inventory/fields.ts` — the table schema,
the importer, the filters, the detail page and the edit form are all generated
from that list, so adding a column means editing that one file and re-running
the seed.

`better-sqlite3` is a native module that needs a real filesystem, so the
inventory routes run locally (or on a Node host with a persistent disk), not on
a serverless deploy.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
