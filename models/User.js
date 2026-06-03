// models/User.js
import { query } from '../lib/db.js';
import bcrypt from 'bcryptjs';

export async function createTable() {
  // Try to add username column if it doesn't exist (for fresh deployments)
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        free_usage_today INT DEFAULT 0,
        subscription_type VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        extra_credits INT DEFAULT 0
      );
    `;
    await query(sql);
  } catch (e) {
    // Table might already exist with old schema - try adding column
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);`);
    } catch (_) {}
  }
}

export async function createUser(identifier, plainPassword) {
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const sql = `INSERT INTO users (identifier, password_hash) VALUES ($1, $2) RETURNING id, identifier, created_at;`;
  const result = await query(sql, [identifier, hashedPassword]);
  return result.rows[0];
}

export async function findUserByIdentifier(identifier) {
  const sql = `SELECT * FROM users WHERE identifier = $1;`;
  const result = await query(sql, [identifier]);
  return result.rows[0];
}

export async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export async function incrementFreeUsage(userId) {
  const sql = `UPDATE users SET free_usage_today = free_usage_today + 1 WHERE id = $1 RETURNING free_usage_today;`;
  const result = await query(sql, [userId]);
  return result.rows[0];
}

export async function getUsageCount(userId) {
  const sql = `SELECT free_usage_today FROM users WHERE id = $1;`;
  const result = await query(sql, [userId]);
  return result.rows[0]?.free_usage_today || 0;
}