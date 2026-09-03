import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Client } = pg;

async function syncLocalToCloud() {
  const targetUrl = process.argv[2] || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!targetUrl || targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
    console.error('\n❌ Please provide your Neon PostgreSQL connection string!');
    console.error('Usage:');
    console.error('  node backend/src/database/restoreToNeon.js "postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require"\n');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('🚀 Pushing Local Docker Data to Neon Cloud PostgreSQL');
  console.log('======================================================\n');
  console.log(`Target Host: ${targetUrl.split('@')[1] ? targetUrl.split('@')[1].split('/')[0] : 'Cloud Postgres'}`);

  const dumpPath = path.join(__dirname, 'cloud_dump.sql');
  if (!fs.existsSync(dumpPath)) {
    console.error(`❌ Dump file not found at ${dumpPath}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon Cloud PostgreSQL successfully!\n');

    console.log('📦 Reading local data dump (5,300+ judges, courts, cases, hearings)...');
    const sql = fs.readFileSync(dumpPath, 'utf8');

    console.log('⏳ Applying schema and inserting all records to Neon (this may take 10-20 seconds)...');
    await client.query(sql);

    console.log('\n🎉 Successfully migrated all local data to Neon Cloud!');

    console.log('\n📊 Cloud Database Row Counts:');
    const res = await client.query(`
      SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int as count 
      FROM (
        SELECT table_name, query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      ) t 
      WHERE table_name IN ('courts', 'cases', 'judges', 'districts', 'states', 'users', 'case_hearings')
      ORDER BY count DESC;
    `);

    for (const row of res.rows) {
      console.log(`  • ${row.table_name.padEnd(16)} : ${row.count} records`);
    }

    console.log('\n✅ Data sync complete! Refresh your web app to see the live data.\n');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await client.end();
  }
}

syncLocalToCloud();
