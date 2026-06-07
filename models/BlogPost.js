// models/BlogPost.js — Blog管理后台数据模型
// Product: Blog CMS — 博客内容管理系统

import { query } from '../lib/db.js';

export async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS blog_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      slug VARCHAR(300) UNIQUE NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      description VARCHAR(400) NOT NULL DEFAULT '',
      keywords TEXT[] DEFAULT '{}',
      category VARCHAR(100) NOT NULL DEFAULT '未分类',
      tags TEXT[] DEFAULT '{}',
      cover_image VARCHAR(500) DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      author_id INTEGER REFERENCES users(id),
      published_at TIMESTAMP,
      view_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(sql);

  // Indexes
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);`);
    // Full-text search index
    await query(`CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON blog_posts USING gin(to_tsvector('simple', title || ' ' || content));`);
  } catch (_) {}
}

export async function createPost({ title, slug, content, description, keywords, category, tags, coverImage, authorId, status = 'draft' }) {
  const now = new Date();
  const publishedAt = status === 'published' ? now : null;
  
  const sql = `
    INSERT INTO blog_posts (title, slug, content, description, keywords, category, tags, cover_image, author_id, status, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
  const result = await query(sql, [
    title.substring(0, 300),
    slug.substring(0, 300),
    content,
    description.substring(0, 400),
    keywords || [],
    category.substring(0, 100),
    tags || [],
    coverImage || '',
    authorId || null,
    status,
    publishedAt,
  ]);
  return result.rows[0];
}

export async function getPostById(id) {
  const sql = `SELECT * FROM blog_posts WHERE id = $1;`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

export async function getPostBySlug(slug) {
  const sql = `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published';`;
  const result = await query(sql, [slug]);
  return result.rows[0] || null;
}

export async function getAdminPostBySlug(slug) {
  const sql = `SELECT * FROM blog_posts WHERE slug = $1;`;
  const result = await query(sql, [slug]);
  return result.rows[0] || null;
}

export async function getPublishedPosts({ limit = 20, offset = 0, category, tag } = {}) {
  let sql = `SELECT id, title, slug, description, keywords, category, tags, cover_image, view_count, published_at, created_at FROM blog_posts WHERE status = 'published'`;
  const params = [];
  let paramIndex = 1;

  if (category) {
    sql += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (tag) {
    sql += ` AND $${paramIndex} = ANY(tags)`;
    params.push(tag);
    paramIndex++;
  }

  sql += ` ORDER BY published_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

export async function getAllPosts({ limit = 50, offset = 0, status, category } = {}) {
  let sql = `SELECT id, title, slug, description, category, status, view_count, published_at, created_at, updated_at FROM blog_posts WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    sql += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  sql += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
}

export async function getPublishedPostCount({ category, tag } = {}) {
  let sql = `SELECT COUNT(*) FROM blog_posts WHERE status = 'published'`;
  const params = [];
  let paramIndex = 1;

  if (category) {
    sql += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (tag) {
    sql += ` AND $${paramIndex} = ANY(tags)`;
    params.push(tag);
    paramIndex++;
  }

  const result = await query(sql, params);
  return parseInt(result.rows[0].count) || 0;
}

export async function updatePost(id, { title, slug, content, description, keywords, category, tags, coverImage, status }) {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (title !== undefined) { updates.push(`title = $${paramIndex}`); params.push(title.substring(0, 300)); paramIndex++; }
  if (slug !== undefined) { updates.push(`slug = $${paramIndex}`); params.push(slug.substring(0, 300)); paramIndex++; }
  if (content !== undefined) { updates.push(`content = $${paramIndex}`); params.push(content); paramIndex++; }
  if (description !== undefined) { updates.push(`description = $${paramIndex}`); params.push(description.substring(0, 400)); paramIndex++; }
  if (keywords !== undefined) { updates.push(`keywords = $${paramIndex}`); params.push(keywords); paramIndex++; }
  if (category !== undefined) { updates.push(`category = $${paramIndex}`); params.push(category.substring(0, 100)); paramIndex++; }
  if (tags !== undefined) { updates.push(`tags = $${paramIndex}`); params.push(tags); paramIndex++; }
  if (coverImage !== undefined) { updates.push(`cover_image = $${paramIndex}`); params.push(coverImage); paramIndex++; }
  
  if (status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
    // If publishing for the first time, set published_at
    if (status === 'published') {
      updates.push(`published_at = COALESCE(published_at, CURRENT_TIMESTAMP)`);
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const sql = `UPDATE blog_posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *;`;
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function deletePost(id) {
  const sql = `DELETE FROM blog_posts WHERE id = $1 RETURNING id;`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

export async function incrementViewCount(slug) {
  const sql = `UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = $1 AND status = 'published' RETURNING view_count;`;
  const result = await query(sql, [slug]);
  return result.rows[0]?.view_count || 0;
}

export async function getCategories() {
  const sql = `SELECT category, COUNT(*)::int as count FROM blog_posts WHERE status = 'published' GROUP BY category ORDER BY count DESC;`;
  const result = await query(sql);
  return result.rows;
}

export async function getAllCategories() {
  const sql = `SELECT category, COUNT(*)::int as count FROM blog_posts GROUP BY category ORDER BY count DESC;`;
  const result = await query(sql);
  return result.rows;
}

export async function getRelatedPosts(slug, limit = 3) {
  // Find posts in same category, excluding current post
  const sql = `
    SELECT id, title, slug, description, category, published_at 
    FROM blog_posts 
    WHERE status = 'published' 
      AND slug != $1 
      AND category = (SELECT category FROM blog_posts WHERE slug = $1)
    ORDER BY published_at DESC 
    LIMIT $2;
  `;
  const result = await query(sql, [slug, limit]);
  return result.rows;
}

export async function searchPosts(queryText, limit = 10) {
  const sql = `
    SELECT id, title, slug, description, category, published_at,
      ts_rank(to_tsvector('simple', title || ' ' || content), plainto_tsquery('simple', $1)) as rank
    FROM blog_posts
    WHERE status = 'published'
      AND to_tsvector('simple', title || ' ' || content) @@ plainto_tsquery('simple', $1)
    ORDER BY rank DESC
    LIMIT $2;
  `;
  const result = await query(sql, [queryText, limit]);
  return result.rows;
}

export async function initTable() {
  await createTable();
  console.log('[BlogPost] Table initialized');
}
