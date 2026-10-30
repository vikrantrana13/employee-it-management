import mysql from 'mysql2/promise';
export function createDatabase() {
  for (const name of ['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME']) {
    if (!process.env[name]) throw new Error(`Missing ${name}. Configure the root .env file.`);
  }
  return mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionLimit: 5, connectTimeout: 3000, dateStrings: true });
}
