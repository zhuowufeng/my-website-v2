// scripts/backup.js — 数据库备份脚本
// 模块8 运维：自动备份 PostgreSQL 数据库
// 用法：node scripts/backup.js [backup-dir]
// 建议配合 cron 定时执行

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse DATABASE_URL
function getDbConfig() {
  const url = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    console.error('[backup] 错误：未设置 DATABASE_URL');
    process.exit(1);
  }

  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      url,
    };
  } catch (e) {
    console.error('[backup] 无法解析 DATABASE_URL:', e.message);
    process.exit(1);
  }
}

function run() {
  const config = getDbConfig();
  const backupDir = path.resolve(process.argv[2] || './backups');

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${config.database}-${timestamp}.sql`;
  const filepath = path.join(backupDir, filename);

  console.log(`[backup] 开始备份数据库: ${config.database}@${config.host}`);
  console.log(`[backup] 输出文件: ${filepath}`);

  // Use PGPASSWORD environment variable for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: config.password,
  };

  try {
    const cmd = `pg_dump --host=${config.host} --port=${config.port} --username=${config.user} --dbname=${config.database} --format=plain --no-owner --no-acl`;
    
    execSync(cmd, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });
    
    // Actually, let's use a simpler approach with pg_dump output to file
    const dumpCmd = [
      `set PGPASSWORD=${config.password}`,
      `&& pg_dump --host=${config.host} --port=${config.port} --username=${config.user} --dbname=${config.database} --format=plain --no-owner --no-acl > "${filepath}"`,
    ].join(' ');

    // Try the simpler inline approach
    try {
      execSync(dumpCmd, {
        shell: true,
        timeout: 30000, // 30 seconds
        stdio: 'pipe',
      });
    } catch (e) {
      // If pg_dump not available, do a SELECT-based backup
      console.log('[backup] pg_dump 不可用，使用 SELECT 查询备份...');
      doQueryBackup(config, filepath);
      return;
    }

    // Clean up old backups (keep last 7)
    cleanupOldBackups(backupDir, 7);

    const stats = fs.statSync(filepath);
    console.log(`[backup] ✅ 备份完成: ${filepath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error('[backup] ❌ 备份失败:', e.message);
    process.exit(1);
  }
}

/**
 * 使用 SQL 查询方式备份数据（当 pg_dump 不可用时）
 */
async function doQueryBackup(config, filepath) {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: config.host,
    port: parseInt(config.port),
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: false,
  });

  try {
    const tables = ['users', 'name_history', 'articles', 'subscriptions', 'feedback'];
    let backupContent = `-- 数据库备份: ${config.database}\n`;
    backupContent += `-- 时间: ${new Date().toISOString()}\n`;
    backupContent += `-- 备份方式: SQL 查询\n\n`;
    backupContent += `BEGIN;\n\n`;

    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM "${table}"`);
        if (result.rows.length === 0) {
          backupContent += `-- ${table}: 无数据\n\n`;
          continue;
        }
        backupContent += `-- ${table}: ${result.rows.length} 行\n`;
        for (const row of result.rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          backupContent += `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${values.join(', ')});\n`;
        }
        backupContent += '\n';
      } catch (e) {
        backupContent += `-- ${table}: 表不存在或查询失败 (${e.message})\n\n`;
      }
    }

    backupContent += `COMMIT;\n`;

    fs.writeFileSync(filepath, backupContent, 'utf-8');
    
    const stats = fs.statSync(filepath);
    console.log(`[backup] ✅ SQL备份完成: ${filepath} (${(stats.size / 1024).toFixed(1)} KB)`);

    cleanupOldBackups(path.dirname(filepath), 7);
  } catch (e) {
    console.error('[backup] ❌ SQL备份失败:', e.message);
  } finally {
    await pool.end();
  }
}

/**
 * 清理旧备份，只保留最近的 N 个
 */
function cleanupOldBackups(dir, keepCount) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[backup] 清理旧备份: ${file.name}`);
      }
    }
  } catch (e) {
    console.warn('[backup] 清理旧备份失败:', e.message);
  }
}

run();
