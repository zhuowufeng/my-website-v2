/**
 * Tech Stack Analyzer API
 * 探测目标网站的技术栈：CMS、框架、服务器、CDN、分析工具、JS库等
 * 使用 HTTP 请求头 + HTML 内容分析实现
 */

import { NextRequest, NextResponse } from 'next/server';

// ============ Types ============

export interface TechItem {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  version?: string;
  icon: string;
}

export type TechCategory =
  | 'server'
  | 'cms'
  | 'framework'
  | 'cdn'
  | 'analytics'
  | 'js-library'
  | 'css-framework'
  | 'hosting'
  | 'email'
  | 'other';

export interface TechResult {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  responseTime: number;
  status: number;
  technologies: TechItem[];
  summary: {
    server: string;
    cms: string;
    framework: string;
    cdn: string;
    analytics: string[];
  };
}

interface HeadersDict {
  [key: string]: string;
}

// ============ Detection Rules ============

interface DetectionRule {
  name: string;
  category: TechCategory;
  icon: string;
  confidence: 'high' | 'medium' | 'low';
  version?: (headers: HeadersDict, html: string) => string | null;
  check: (headers: HeadersDict, html: string) => boolean;
}

const DETECTION_RULES: DetectionRule[] = [
  // ===== Servers =====
  {
    name: 'Nginx',
    category: 'server',
    icon: '🔶',
    confidence: 'high',
    check: (h) => (h['server'] || '').toLowerCase().includes('nginx'),
    version: (h) => {
      const m = (h['server'] || '').match(/nginx\/([\d.]+)/);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Apache',
    category: 'server',
    icon: '🟥',
    confidence: 'high',
    check: (h) => {
      const s = (h['server'] || '').toLowerCase();
      return s.includes('apache') || s.includes('httpd');
    },
    version: (h) => {
      const m = (h['server'] || '').match(/(?:Apache|httpd)\/([\d.]+)/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'IIS',
    category: 'server',
    icon: '🟦',
    confidence: 'high',
    check: (h) => (h['server'] || '').toLowerCase().includes('iis'),
    version: (h) => {
      const m = (h['server'] || '').match(/IIS\/([\d.]+)/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Node.js',
    category: 'server',
    icon: '🟢',
    confidence: 'medium',
    check: (h) => {
      const s = (h['server'] || '').toLowerCase();
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return s.includes('node') || xp.includes('node') || xp.includes('express');
    },
  },
  {
    name: 'Express',
    category: 'framework',
    icon: '⚡',
    confidence: 'medium',
    check: (h) => {
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return xp.includes('express');
    },
  },
  {
    name: 'Next.js',
    category: 'framework',
    icon: '▲',
    confidence: 'high',
    check: (h, html) => {
      return (
        !!h['x-nextjs-page'] ||
        !!h['x-nextjs-cache'] ||
        !!h['x-middleware-next'] ||
        html.includes('__NEXT_DATA__') ||
        html.includes('__NEXT_LOADED_PAGES__') ||
        html.includes('/_next/static')
      );
    },
    version: (_, html) => {
      const m = html.match(/"version":"([^"]+)"/);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Vercel',
    category: 'hosting',
    icon: '▲',
    confidence: 'high',
    check: (h) => !!h['x-vercel-id'] || !!h['x-vercel-deployment-url'],
  },

  // ===== CMS =====
  {
    name: 'WordPress',
    category: 'cms',
    icon: '🔵',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('/wp-content/') ||
        l.includes('/wp-includes/') ||
        l.includes('wp-json') ||
        l.includes('wp-block-library') ||
        /<meta\s+name=["']generator["'][^>]*content=["']WordPress/i.test(html)
      );
    },
    version: (_, html) => {
      const m = html.match(/content=["']WordPress\s+([\d.]+)["']/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Ghost',
    category: 'cms',
    icon: '👻',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('ghost') &&
        (l.includes('ghost_foot') || /<meta\s+name=["']generator["'][^>]*content=["']Ghost/i.test(html))
      );
    },
  },
  {
    name: 'Shopify',
    category: 'cms',
    icon: '🛒',
    confidence: 'high',
    check: (h, html) => {
      const l = html.toLowerCase();
      return (
        !!h['x-shopid'] ||
        !!h['x-shopify-stage'] ||
        l.includes('shopify.com') ||
        l.includes('/cdn/shop/') ||
        l.includes('shopify')
      );
    },
  },
  {
    name: 'Wix',
    category: 'cms',
    icon: '🔶',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('wix.com') || l.includes('static.wixstatic.com') || l.includes('wix-bridge');
    },
  },
  {
    name: 'Squarespace',
    category: 'cms',
    icon: '⬜',
    confidence: 'high',
    check: (_, html) => html.toLowerCase().includes('squarespace'),
  },
  {
    name: 'Drupal',
    category: 'cms',
    icon: '🔷',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('drupal') &&
        (/<meta\s+name=["']generator["'][^>]*content=["']Drupal/i.test(html) ||
          l.includes('/sites/default/files/') ||
          l.includes('drupal.js'))
      );
    },
  },

  // ===== Frontend Frameworks =====
  {
    name: 'React',
    category: 'framework',
    icon: '⚛️',
    confidence: 'high',
    check: (_, html) => {
      return (
        html.includes('react') &&
        (html.includes('React.createElement') ||
          html.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') ||
          /react\.production|react\.development/i.test(html) ||
          html.includes('data-reactroot') ||
          html.includes('data-reactid'))
      );
    },
  },
  {
    name: 'Vue.js',
    category: 'framework',
    icon: '💚',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        html.includes('__VUE__') ||
        l.includes('vue.js') ||
        /data-v-[a-f0-9]{6,}/.test(html) ||
        l.includes('vue-router') ||
        l.includes('vuex')
      );
    },
  },
  {
    name: 'Angular',
    category: 'framework',
    icon: '🔴',
    confidence: 'high',
    check: (_, html) => {
      return (
        html.includes('ng-version') ||
        /ng-app/i.test(html) ||
        html.includes('angular') ||
        html.includes('zone.js')
      );
    },
  },
  {
    name: 'Svelte',
    category: 'framework',
    icon: '🟠',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('svelte') || /svelte-[\da-f]{6,}/.test(html);
    },
  },

  // ===== CDN =====
  {
    name: 'Cloudflare',
    category: 'cdn',
    icon: '☁️',
    confidence: 'high',
    check: (h) => {
      return !!h['cf-ray'] || !!h['cf-cache-status'] || !!h['cf-edge-cache'] || (h['server'] || '').toLowerCase().includes('cloudflare');
    },
  },
  {
    name: 'Cloudflare Proxy',
    category: 'cdn',
    icon: '☁️',
    confidence: 'low',
    check: (h) => {
      const via = (h['via'] || '').toLowerCase();
      const expectCt = (h['expect-ct'] || '').toLowerCase();
      return via.includes('cloudflare') || expectCt.includes('cloudflare');
    },
  },
  {
    name: 'Fastly',
    category: 'cdn',
    icon: '⚡',
    confidence: 'high',
    check: (h) => {
      const served = (h['x-served-by'] || '').toLowerCase();
      const cache = (h['x-cache'] || '').toLowerCase();
      const srv = (h['server'] || '').toLowerCase();
      return served.includes('fastly') || srv.includes('fastly') || served.includes('cache');
    },
  },
  {
    name: 'Akamai',
    category: 'cdn',
    icon: '🔶',
    confidence: 'high',
    check: (h) => {
      const srv = (h['server'] || '').toLowerCase();
      const via = (h['via'] || '').toLowerCase();
      return srv.includes('akamai') || via.includes('akamai');
    },
  },
  {
    name: 'CloudFront',
    category: 'cdn',
    icon: '☁️',
    confidence: 'high',
    check: (h) => {
      const srv = (h['server'] || '').toLowerCase();
      const via = (h['via'] || '').toLowerCase();
      return srv.includes('cloudfront') || via.includes('cloudfront') || !!h['x-amz-cf-id'];
    },
  },

  // ===== Analytics =====
  {
    name: 'Google Analytics',
    category: 'analytics',
    icon: '📊',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        /gtag\s*\(/.test(html) ||
        /ga\s*\(/.test(html) ||
        /ga\s*\(/.test(html) ||
        l.includes('google-analytics.com/analytics.js') ||
        l.includes('google-analytics.com/ga.js') ||
        l.includes('analytics.js') ||
        l.includes('gtag/js')
      );
    },
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    icon: '🏷️',
    confidence: 'high',
    check: (_, html) => {
      return (
        html.includes('googletagmanager.com/gtm.js') ||
        html.includes('googletagmanager.com/ns.html') ||
        /GTM-[A-Z0-9]+/.test(html)
      );
    },
  },
  {
    name: 'Baidu Analytics',
    category: 'analytics',
    icon: '🇨🇳',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('hm.baidu.com') || l.includes('tongji.baidu.com');
    },
  },
  {
    name: 'Facebook Pixel',
    category: 'analytics',
    icon: '📘',
    confidence: 'high',
    check: (_, html) => {
      return /fbq\s*\(/.test(html) || html.includes('connect.facebook.net') || html.includes('facebook-pixel');
    },
  },
  {
    name: 'Microsoft Clarity',
    category: 'analytics',
    icon: '🔵',
    confidence: 'high',
    check: (_, html) => {
      return html.includes('clarity.ms');
    },
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    icon: '🔥',
    confidence: 'high',
    check: (_, html) => html.toLowerCase().includes('hotjar'),
  },
  {
    name: 'Cloudflare Web Analytics',
    category: 'analytics',
    icon: '☁️',
    confidence: 'medium',
    check: (_, html) => html.includes('cloudflareinsights.com'),
  },
  {
    name: 'Umami',
    category: 'analytics',
    icon: '📈',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('umami') && (l.includes('umami.is') || l.includes('umami.js'));
    },
  },
  {
    name: 'Plausible',
    category: 'analytics',
    icon: '📉',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('plausible.io') || l.includes('plausible.js');
    },
  },

  // ===== JS Libraries =====
  {
    name: 'jQuery',
    category: 'js-library',
    icon: '🟣',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('jquery') || l.includes('jquery.js') || l.includes('jquery.min.js');
    },
    version: (_, html) => {
      const m = html.match(/jquery[.-]?([\d.]+)\.(?:min\.)?js/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Bootstrap',
    category: 'css-framework',
    icon: '🟣',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('bootstrap') &&
        (l.includes('bootstrap.min.css') || l.includes('bootstrap.css') || l.includes('bootstrap.bundle'))
      );
    },
    version: (_, html) => {
      const m = html.match(/bootstrap[@.-]?([\d.]+)/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Tailwind CSS',
    category: 'css-framework',
    icon: '🌊',
    confidence: 'high',
    check: (_, html) => {
      return (
        html.includes('tailwind') ||
        html.includes('tailwindcss') ||
        html.includes('cdn.tailwindcss.com')
      );
    },
  },
  {
    name: 'Lodash',
    category: 'js-library',
    icon: '📦',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('lodash');
    },
  },
  {
    name: 'Three.js',
    category: 'js-library',
    icon: '🎮',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('three.js') || l.includes('three.min.js') || l.includes('three.module.js');
    },
  },
  {
    name: 'Chart.js',
    category: 'js-library',
    icon: '📊',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('chart.js') || l.includes('chart.min.js');
    },
  },
  {
    name: 'GSAP',
    category: 'js-library',
    icon: '🎬',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('gsap') || l.includes('tweenmax') || l.includes('tweenlite');
    },
  },
  {
    name: 'Swiper',
    category: 'js-library',
    icon: '🔄',
    confidence: 'medium',
    check: (_, html) => html.toLowerCase().includes('swiper'),
  },
  {
    name: 'Font Awesome',
    category: 'css-framework',
    icon: '🎯',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('font-awesome') ||
        l.includes('fontawesome') ||
        l.includes('fa-brands') ||
        l.includes('fa-solid')
      );
    },
  },

  // ===== Email Services =====
  {
    name: 'MailChimp',
    category: 'email',
    icon: '📧',
    confidence: 'medium',
    check: (_, html) => html.toLowerCase().includes('mailchimp'),
  },
  {
    name: 'SendGrid',
    category: 'email',
    icon: '📧',
    confidence: 'medium',
    check: (_, html) => html.toLowerCase().includes('sendgrid'),
  },

  // ===== Other =====
  {
    name: 'AMP',
    category: 'other',
    icon: '⚡',
    confidence: 'high',
    check: (_, html) => {
      return (
        /<html[^>]*amp[>\s]/i.test(html) ||
        html.includes('⚡') ||
        /<link[^>]*rel=["']?amphtml["']?/i.test(html)
      );
    },
  },
  {
    name: 'Google Fonts',
    category: 'other',
    icon: '🔤',
    confidence: 'high',
    check: (_, html) => html.includes('fonts.googleapis.com'),
  },
  {
    name: 'reCAPTCHA',
    category: 'other',
    icon: '🛡️',
    confidence: 'high',
    check: (_, html) => {
      return (
        html.includes('recaptcha') ||
        html.includes('g-recaptcha') ||
        html.includes('google.com/recaptcha')
      );
    },
  },
  {
    name: 'Disqus',
    category: 'other',
    icon: '💬',
    confidence: 'high',
    check: (_, html) => html.toLowerCase().includes('disqus'),
  },
  {
    name: 'Open Graph',
    category: 'other',
    icon: '📝',
    confidence: 'high',
    check: (_, html) => /<meta[^>]*property=["']og:/i.test(html),
  },
  {
    name: 'Twitter Cards',
    category: 'other',
    icon: '🐦',
    confidence: 'high',
    check: (_, html) => /<meta[^>]*name=["']twitter:/i.test(html),
  },
  {
    name: 'JSON-LD',
    category: 'other',
    icon: '📋',
    confidence: 'high',
    check: (_, html) => /<script[^>]*type=["']application\/ld\+json["']/i.test(html),
  },
  {
    name: 'Google Adsense',
    category: 'analytics',
    icon: '💰',
    confidence: 'high',
    check: (_, html) => {
      const l = html.toLowerCase();
      return (
        l.includes('adsbygoogle') ||
        l.includes('googleads') ||
        l.includes('googlesyndication.com')
      );
    },
  },
  {
    name: 'Google Ads',
    category: 'analytics',
    icon: '💰',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('googletagservices.com') || l.includes('doubleclick.net');
    },
  },
  {
    name: 'PHP',
    category: 'server',
    icon: '🐘',
    confidence: 'medium',
    check: (h) => {
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return xp.includes('php') || !!h['x-php'];
    },
    version: (h) => {
      const m = (h['x-powered-by'] || '').match(/PHP\/([\d.]+)/i);
      return m ? m[1] : null;
    },
  },
  {
    name: 'Python',
    category: 'server',
    icon: '🐍',
    confidence: 'medium',
    check: (h) => {
      const s = (h['server'] || '').toLowerCase();
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return s.includes('python') || xp.includes('python') || s.includes('gunicorn') || s.includes('uvicorn');
    },
  },
  {
    name: 'Gunicorn',
    category: 'server',
    icon: '🦄',
    confidence: 'medium',
    check: (h) => (h['server'] || '').toLowerCase().includes('gunicorn'),
  },
  {
    name: 'Ruby on Rails',
    category: 'framework',
    icon: '💎',
    confidence: 'medium',
    check: (h) => {
      const xp = (h['x-powered-by'] || '').toLowerCase();
      const s = (h['server'] || '').toLowerCase();
      return xp.includes('rails') || xp.includes('ruby') || s.includes('passenger');
    },
  },
  {
    name: 'Django',
    category: 'framework',
    icon: '🎸',
    confidence: 'medium',
    check: (h) => {
      const s = (h['server'] || '').toLowerCase();
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return s.includes('django') || xp.includes('django') || !!h['x-django'];
    },
  },
  {
    name: 'Laravel',
    category: 'framework',
    icon: '⚔️',
    confidence: 'medium',
    check: (h) => {
      const xp = (h['x-powered-by'] || '').toLowerCase();
      return xp.includes('laravel');
    },
  },
  {
    name: 'Nuxt.js',
    category: 'framework',
    icon: '💚',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('nuxt') || /__NUXT__/.test(html) || l.includes('_nuxt/');
    },
  },
  {
    name: 'Gatsby',
    category: 'framework',
    icon: '🔥',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return l.includes('gatsby') && l.includes('___gatsby');
    },
  },
  {
    name: 'Hugo',
    category: 'framework',
    icon: '🐹',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return /<meta\s+name=["']generator["'][^>]*content=["']Hugo/i.test(html);
    },
  },
  {
    name: 'Jekyll',
    category: 'framework',
    icon: '💎',
    confidence: 'medium',
    check: (_, html) => {
      const l = html.toLowerCase();
      return /<meta\s+name=["']generator["'][^>]*content=["']Jekyll/i.test(html);
    },
  },
  {
    name: 'Alpine.js',
    category: 'js-library',
    icon: '🏔️',
    confidence: 'medium',
    check: (_, html) => {
      return html.includes('alpinejs') || html.includes('alpine.js') || html.includes('x-data');
    },
  },
  {
    name: 'HMR',
    category: 'other',
    icon: '🔄',
    confidence: 'low',
    check: (h) => !!h['x-hmr'],
  },
  {
    name: 'CORS Enabled',
    category: 'other',
    icon: '🌐',
    confidence: 'low',
    check: (h) => {
      const acao = h['access-control-allow-origin'];
      return !!acao && acao !== 'null';
    },
  },
  {
    name: 'HSTS Enabled',
    category: 'other',
    icon: '🔒',
    confidence: 'high',
    check: (h) => !!h['strict-transport-security'],
  },
];

// ============ Helper Functions ============

function sanitizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const u = new URL(url);
    if (!u.hostname || !u.hostname.includes('.')) return '';
    return url;
  } catch {
    return '';
  }
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, 'i'),
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return '';
}

function countTechType(technologies: TechItem[], category: TechCategory): number {
  return technologies.filter(t => t.category === category).length;
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json(
      { error: '请提供 url 参数，如 ?url=example.com' },
      { status: 400 }
    );
  }

  const cleanUrl = sanitizeUrl(urlParam);
  if (!cleanUrl) {
    return NextResponse.json(
      { error: 'URL 格式不正确，请输入有效网址（如 example.com 或 https://example.com）' },
      { status: 400 }
    );
  }

  try {
    const start = Date.now();

    const response = await fetch(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SinmonikerTechAnalyzer/1.0; +https://sinmoniker.com/tech-analyzer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
    });

    const responseTime = Date.now() - start;

    // Convert headers
    const headers: HeadersDict = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Read HTML content
    let html = '';
    try {
      html = await response.text();
    } catch {
      html = '';
    }

    // Run detection
    const technologies: TechItem[] = [];
    for (const rule of DETECTION_RULES) {
      try {
        if (rule.check(headers, html)) {
          const tech: TechItem = {
            name: rule.name,
            category: rule.category,
            confidence: rule.confidence,
            icon: rule.icon,
          };
          if (rule.version) {
            const ver = rule.version(headers, html);
            if (ver) tech.version = ver;
          }
          technologies.push(tech);
        }
      } catch {
        // Skip rule on error
      }
    }

    // Deduplicate - keep highest confidence
    const seen = new Set<string>();
    const deduped: TechItem[] = [];
    for (const tech of technologies) {
      const key = `${tech.name}:${tech.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(tech);
      }
    }

    // Extract title & description
    const title =
      extractMetaContent(html, 'title') ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
      '';
    const description = extractMetaContent(html, 'description');

    const finalUrl = response.url || cleanUrl;

    // Build summary
    const servers = deduped.filter(t => t.category === 'server').map(t => t.name);
    const cms = deduped.filter(t => t.category === 'cms').map(t => t.name);
    const frameworks = deduped.filter(t => t.category === 'framework').map(t => t.name);
    const cdns = deduped.filter(t => t.category === 'cdn').map(t => t.name);
    const analytics = deduped.filter(t => t.category === 'analytics').map(t => t.name);

    const result: TechResult = {
      url: cleanUrl,
      finalUrl,
      title,
      description,
      responseTime,
      status: response.status,
      technologies: deduped,
      summary: {
        server: servers.join(', ') || '未知',
        cms: cms.join(', ') || '未知',
        framework: frameworks.join(', ') || '未知',
        cdn: cdns.join(', ') || '未知',
        analytics,
      },
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `探测失败: ${err?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
