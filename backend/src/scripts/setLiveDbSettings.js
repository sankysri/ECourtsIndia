import { testDbConnection, pool } from '../config/database.js';

async function main() {
  await testDbConnection();
  await pool.query('UPDATE system_settings SET value = $1 WHERE key = $2', [
    JSON.stringify('https://webapi.ecourtsindia.com'),
    'ecourts_api_base_url'
  ]);
  await pool.query('UPDATE system_settings SET value = $1 WHERE key = $2', [
    JSON.stringify('eci_live_i419y6eszthgyzpxp2ysnjbusqbwqlnn'),
    'ecourts_api_key'
  ]);
  await pool.query('UPDATE system_settings SET value = $1 WHERE key = $2', [
    JSON.stringify(false),
    'ecourts_use_mock'
  ]);

  const res = await pool.query('SELECT key, value FROM system_settings WHERE key LIKE $1', ['ecourts%']);
  console.log('Updated DB settings:', res.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
