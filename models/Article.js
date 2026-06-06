// models/Article.js - 墨言写作工具的文章历史
// Module 3 验证项目：后端 & 数据库

import { query } from '../lib/db.js';

export async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      topic VARCHAR(500) NOT NULL,
      article_type VARCHAR(50) NOT NULL DEFAULT 'blog',
      title VARCHAR(300),
      content TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(sql);

  // Add index for faster queries
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles USING gin(to_tsvector('simple', topic));`);
  } catch (_) {
    // Index may already exist
  }
}

export async function saveArticle({ userId, topic, articleType, title, content }) {
  const wordCount = content.replace(/\s/g, '').length;
  const sql = `
    INSERT INTO articles (user_id, topic, article_type, title, content, word_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, topic, article_type, title, word_count, created_at;
  `;
  const result = await query(sql, [
    userId || null,
    topic.substring(0, 500),
    (articleType || 'blog').substring(0, 50),
    (title || '').substring(0, 300) || null,
    content,
    wordCount,
  ]);
  return result.rows[0];
}

export async function getArticleById(id) {
  const sql = `SELECT * FROM articles WHERE id = $1;`;
  const result = await query(sql, [id]);
  return result.rows[0];
}

export async function getUserArticles(userId, { limit = 20, offset = 0, type, search } = {}) {
  let sql = `SELECT id, topic, article_type, title, word_count, created_at FROM articles WHERE user_id = $1`;
  const params = [userId];
  let paramIndex = 2;

  if (type && type !== 'all') {
    sql += ` AND article_type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  if (search) {
    sql += ` AND topic ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

export async function getUserArticleCount(userId, { type, search } = {}) {
  let sql = `SELECT COUNT(*) FROM articles WHERE user_id = $1`;
  const params = [userId];
  let paramIndex = 2;

  if (type && type !== 'all') {
    sql += ` AND article_type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  if (search) {
    sql += ` AND topic ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  const result = await query(sql, params);
  return parseInt(result.rows[0].count) || 0;
}

export async function deleteArticle(id, userId) {
  const sql = `DELETE FROM articles WHERE id = $1 AND user_id = $2 RETURNING id;`;
  const result = await query(sql, [id, userId]);
  return result.rows[0] || null;
}

export async function initDatabase() {
  // Initialize all tables
  const { createTable: createUsersTable } = await import('./User.js');
  const { createTable: createNameHistoryTable } = await import('./NameHistory.js');
  
  await createUsersTable();
  await createNameHistoryTable();
  await createTable();
  
  console.log('[db] All tables initialized');
}
