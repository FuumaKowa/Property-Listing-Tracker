import 'dotenv/config';
import { Client } from 'pg';
import { INITIAL_PROPERTY_LISTINGS } from '../src/data/initialData.ts';

const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL or NEON_DATABASE_URL must be set.');
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  const existing = await client.query('SELECT COUNT(*) AS count FROM public.listings');
  const count = Number(existing.rows[0].count);

  if (count > 0) {
    console.log(`ALREADY_HAS_ROWS: ${count}`);
    await client.end();
    return;
  }

  const valuesClause = INITIAL_PROPERTY_LISTINGS.map((_, index) => {
    const start = index * 10 + 1;
    return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6}, $${start + 7}, $${start + 8}, $${start + 9})`;
  }).join(', ');

  const params: any[] = [];
  for (const item of INITIAL_PROPERTY_LISTINGS) {
    params.push(
      item.property,
      item.projectCategory || 'Project Marketing (PM)',
      item.location,
      item.tenure || '-',
      item.pm || '-',
      item.availableUnits || '-',
      item.status || 'Active',
      item.date || '',
      item.renewStatus || 'Not Renewed',
      item.notes ?? null
    );
  }

  await client.query(
    `INSERT INTO public.listings (property, project_category, location, tenure, pm, available_units, status, date, renew_status, notes) VALUES ${valuesClause}`,
    params
  );

  console.log(`SEEDED_ROWS: ${INITIAL_PROPERTY_LISTINGS.length}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
