// models/NameHistory.js
import { query } from '../lib/db.js';

export async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS name_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      english_name VARCHAR(100) NOT NULL,
      gender VARCHAR(10) DEFAULT 'any',
      results JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(sql);
}

export async function addRecord(userId, englishName, gender, results) {
  const sql = `
    INSERT INTO name_history (user_id, english_name, gender, results)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at;
  `;
  const safeName = englishName.substring(0, 100);
  const safeGender = (gender || 'any').substring(0, 10);
  const result = await query(sql, [userId, safeName, safeGender, JSON.stringify(results)]);
  return result.rows[0];
}

export async function getHistory(userId, limit = 20) {
  const sql = `
    SELECT id, english_name, gender, results, created_at
    FROM name_history
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows;
}
