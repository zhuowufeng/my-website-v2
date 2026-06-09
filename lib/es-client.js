/**
 * lib/es-client.js — Elasticsearch 连接管理器
 * 
 * 模块14·高级：Elasticsearch 搜索优化
 * 
 * 功能：
 * - 连接 Elasticsearch（Cloud 或 自托管）
 * - 优雅降级：ES 不可用时返回 null，调用方 fallback 到 PostgreSQL
 * - 连接健康检查
 * - 支持 API Key 和 用户名/密码 两种认证方式
 * 
 * 环境变量：
 * - ES_NODE=https://xxx.es.us-east-1.aws.cloud.es.io:443
 * - ES_API_KEY=base64encodedapikey  或
 * - ES_USERNAME=elastic
 * - ES_PASSWORD=xxx
 * - ES_INDEX_PREFIX=mywebsite  (可选，默认 'mywebsite')
 */

let client = null;
let isConnected = false;

/**
 * 初始化 Elasticsearch 客户端
 * 如果环境变量未配置，静默返回 null（使用 PostgreSQL 回退）
 */
export async function getESClient() {
  if (client && isConnected) return client;

  const node = process.env.ES_NODE;
  if (!node) {
    // ES not configured — graceful fallback
    return null;
  }

  try {
    const { Client } = await import('@elastic/elasticsearch');

    const config = { node };

    // API Key 优先
    if (process.env.ES_API_KEY) {
      config.auth = { apiKey: process.env.ES_API_KEY };
    } else if (process.env.ES_USERNAME && process.env.ES_PASSWORD) {
      config.auth = {
        username: process.env.ES_USERNAME,
        password: process.env.ES_PASSWORD,
      };
    }

    // Cloud ID 支持（Elastic Cloud 简化连接）
    if (process.env.ES_CLOUD_ID) {
      delete config.node;
      config.cloud = { id: process.env.ES_CLOUD_ID };
    }

    client = new Client(config);

    // 验证连接
    const info = await client.info();
    console.log(`[ES Client] ✅ 连接成功 — 集群: ${info.cluster_name}, 版本: ${info.version.number}`);
    isConnected = true;

    return client;
  } catch (err) {
    console.error(`[ES Client] ❌ 连接失败: ${err.message}`);
    console.error('[ES Client] 将使用 PostgreSQL 全文搜索作为回退');
    client = null;
    isConnected = false;
    return null;
  }
}

/**
 * 检查 ES 是否可用
 */
export async function isESAvailable() {
  if (client && isConnected) return true;
  const es = await getESClient();
  return es !== null;
}

/**
 * 获取索引前缀
 */
export function getIndexPrefix() {
  return process.env.ES_INDEX_PREFIX || 'mywebsite';
}

/**
 * 获取完整索引名
 */
export function getIndexName(type) {
  const prefix = getIndexPrefix();
  return `${prefix}-${type}`;
}

/**
 * 所有需要的索引及其映射定义
 */
export const INDEX_DEFINITIONS = {
  articles: {
    name: () => getIndexName('articles'),
    mappings: {
      settings: {
        analysis: {
          analyzer: {
            // 中文分词分析器（需要安装 analysis-ik 或 analysis-smartcn 插件）
            // 如果没有插件，elasticsearch 内置的 standard+icu_tokenizer 也能用
            chinese_analyzer: {
              type: 'standard',
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'integer' },
          title: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
              // 中文子字段
              chinese: {
                type: 'text',
                analyzer: 'standard',
              },
            },
          },
          content: {
            type: 'text',
            analyzer: 'standard',
          },
          topic: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          article_type: { type: 'keyword' },
          word_count: { type: 'integer' },
          created_at: { type: 'date' },
          // 提升搜索结果相关性的字段
          title_boost: {
            type: 'rank_feature',
          },
          recency_boost: {
            type: 'rank_feature',
          },
        },
      },
    },
  },
  scraped_pages: {
    name: () => getIndexName('scraped_pages'),
    mappings: {
      mappings: {
        properties: {
          id: { type: 'integer' },
          url: { type: 'keyword' },
          domain: {
            type: 'keyword',
            fields: {
              text: { type: 'text' },
            },
          },
          title: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          meta_description: { type: 'text' },
          og_title: { type: 'text' },
          og_image: { type: 'keyword' },
          word_count: { type: 'integer' },
          status_code: { type: 'integer' },
          crawled_at: { type: 'date' },
          title_boost: { type: 'rank_feature' },
          recency_boost: { type: 'rank_feature' },
        },
      },
    },
  },
  seo_analyses: {
    name: () => getIndexName('seo_analyses'),
    mappings: {
      mappings: {
        properties: {
          id: { type: 'integer' },
          url: { type: 'keyword' },
          domain: { type: 'keyword' },
          score: { type: 'integer' },
          grade: { type: 'keyword' },
          page_title: { type: 'text' },
          report: { type: 'object', enabled: false }, // JSON 不索引内部字段
          created_at: { type: 'date' },
          score_boost: { type: 'rank_feature' },
        },
      },
    },
  },
};

export default { getESClient, isESAvailable, getIndexPrefix, getIndexName, INDEX_DEFINITIONS };
