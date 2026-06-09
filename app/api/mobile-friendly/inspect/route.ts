// app/api/mobile-friendly/inspect/route.ts
// 🚀 Mobile-Friendly Test API
// 服务端 HTML 解析 + 15项移动友好检测 + 评分系统

import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Types
// ============================================================

type CheckResult = {
  status: 'pass' | 'warning' | 'fail';
  label: string;
  detail: string;
  suggestion: string;
};

type ViewportInfo = {
  content: string;
  hasWidth: boolean;
  hasInitialScale: boolean;
  hasMaximumScale: boolean;
  hasUserScalable: boolean;
  isResponsive: boolean;
};

type FontSizeInfo = {
  minFontSize: number;
  smallTextCount: number;
  totalTextElements: number;
};

type TouchTargetInfo = {
  totalLinks: number;
  smallLinks: number;
  smallButtons: number;
  smallInputs: number;
};

type ResponsiveInfo = {
  hasMediaQueries: boolean;
  mediaQueryCount: number;
  hasFlexbox: boolean;
  hasGrid: boolean;
  hasFluidImages: boolean;
  hasOverflowHidden: boolean;
};

type WhoisData = {
  viewport: ViewportInfo;
  fonts: FontSizeInfo;
  touchTargets: TouchTargetInfo;
  responsive: ResponsiveInfo;
  hasAppleTouchIcon: boolean;
  hasTapHighlightColor: boolean;
  metaViewportRaw: string | null;
  doctype: string | null;
  hasMobileNav: boolean;
};

export type AnalysisResult = {
  url: string;
  score: number;
  checks: CheckResult[];
  details: WhoisData;
  suggestions: string[];
  timestamp: string;
};

// ============================================================
// URL Helpers
// ============================================================

function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  // Remove trailing slash for cleaner display
  return url;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ============================================================
// Detection Functions
// ============================================================

function analyzeViewport(html: string): { viewport: ViewportInfo; metaRaw: string | null } {
  const vpMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
  const contentMatch = vpMatch
    ? vpMatch[0].match(/content=["']([^"']*)["']/)
    : null;
  const content = contentMatch ? contentMatch[1] : '';

  const hasWidth = /width\s*=\s*(device-width|\d+)/i.test(content);
  const hasInitialScale = /initial-scale/i.test(content);
  const hasMaximumScale = /maximum-scale/i.test(content);
  const hasUserScalable = /user-scalable/i.test(content);

  // Check if it's responsive (width=device-width typically)
  const isResponsive = /width\s*=\s*device-width/i.test(content);

  return {
    viewport: {
      content,
      hasWidth,
      hasInitialScale,
      hasMaximumScale,
      hasUserScalable,
      isResponsive,
    },
    metaRaw: content || null,
  };
}

function analyzeFontSizes(html: string): FontSizeInfo {
  // Check inline styles for font-size
  const fontSizeRegex = /font-size\s*:\s*([\d.]+)px/gi;
  let match;
  let minFontSize = 16; // default browser minimum
  let smallTextCount = 0;
  let totalTextElements = 0;

  while ((match = fontSizeRegex.exec(html)) !== null) {
    totalTextElements++;
    const size = parseFloat(match[1]);
    if (size < 16 && size > 0) {
      smallTextCount++;
      if (size < minFontSize) minFontSize = size;
    }
  }

  // Also check style tags for CSS font-size rules
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  for (const block of styleBlocks) {
    const cssFontRegex = /font-size\s*:\s*([\d.]+)px/gi;
    while ((match = cssFontRegex.exec(block)) !== null) {
      totalTextElements++;
      const size = parseFloat(match[1]);
      if (size < 16 && size > 0) {
        smallTextCount++;
        if (size < minFontSize) minFontSize = size;
      }
    }
  }

  return {
    minFontSize: minFontSize === 16 ? 16 : minFontSize,
    smallTextCount,
    totalTextElements,
  };
}

function analyzeTouchTargets(html: string): TouchTargetInfo {
  const $links = html.match(/<a[\s>]/gi) || [];
  const $buttons = html.match(/<button[\s>]/gi) || [];
  const $inputs = html.match(/<input[\s>]/gi) || [];

  // Check for small inline style dimensions
  const smallLinkRegex = /<a[^>]*style=["'][^"']*?(width|height|padding)\s*:\s*(\d+)px[^"']*?["'][^>]*>/gi;
  let match;
  let smallLinks = 0;
  while ((match = smallLinkRegex.exec(html)) !== null) {
    const val = parseInt(match[2]);
    if (val < 48) smallLinks++;
  }

  // Reset and check buttons
  const smallBtnRegex = /<button[^>]*style=["'][^"']*?(width|height|padding)\s*:\s*(\d+)px[^"']*?["'][^>]*>/gi;
  let smallButtons = 0;
  while ((match = smallBtnRegex.exec(html)) !== null) {
    const val = parseInt(match[2]);
    if (val < 48) smallButtons++;
  }

  // Check inputs
  const smallInputRegex = /<input[^>]*style=["'][^"']*?(width|height|padding)\s*:\s*(\d+)px[^"']*?["'][^>]*>/gi;
  let smallInputs = 0;
  while ((match = smallInputRegex.exec(html)) !== null) {
    const val = parseInt(match[2]);
    if (val < 48) smallInputs++;
  }

  return {
    totalLinks: $links.length,
    smallLinks,
    smallButtons,
    smallInputs,
  };
}

function analyzeResponsiveCSS(html: string): ResponsiveInfo {
  const mediaQueryRegex = /@media\s*(?:screen|only\s*screen|all)?\s*(?:and\s*)?\(/gi;
  const mediaQueries = html.match(mediaQueryRegex) || [];

  // Detect flexbox usage in inline styles
  const flexboxRegex = /display\s*:\s*(flex|inline-flex)/gi;
  const hasFlexbox = flexboxRegex.test(html);

  // Detect grid
  const gridRegex = /display\s*:\s*grid|display\s*:\s*inline-grid/gi;
  const hasGrid = gridRegex.test(html);

  // Fluid images
  const fluidImgRegex = /max-width\s*:\s*100%/gi;
  // Also check style tags for img max-width
  const styleMatch = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  let hasFluidImages = false;
  for (const block of styleMatch) {
    if (/img[^{]*\{[^}]*max-width\s*:\s*100%/i.test(block) ||
        /\.(?:img|image|photo|responsive)[^{]*\{[^}]*max-width\s*:\s*100%/i.test(block)) {
      hasFluidImages = true;
      break;
    }
  }
  // Also check inline
  if (fluidImgRegex.test(html) && !hasFluidImages) {
    // Re-check carefully - this runs after the previous test exhausted the regex
    const hr = html.match(/max-width\s*:\s*100%/gi);
    if (hr && hr.length > 0) hasFluidImages = true;
  }

  // Overflow hidden
  const overflowRegex = /overflow[-\w]*\s*:\s*hidden/gi;
  const hasOverflowHidden = overflowRegex.test(html);

  return {
    hasMediaQueries: mediaQueries.length > 0,
    mediaQueryCount: mediaQueries.length,
    hasFlexbox,
    hasGrid,
    hasFluidImages,
    hasOverflowHidden,
  };
}

function analyzeHTMLStructure(html: string): {
  hasAppleTouchIcon: boolean;
  hasTapHighlightColor: boolean;
  doctype: string | null;
  hasMobileNav: boolean;
} {
  // Apple touch icon (for iOS home screen)
  const appleTouchIcon = /<link[^>]*rel=["']apple-touch-icon["'][^>]*>/i.test(html);

  // Tap highlight color
  const tapHighlight = /[-]webkit-tap-highlight-color/i.test(html);

  // Doctype
  const doctypeMatch = html.match(/<!DOCTYPE\s+([^>]+)>/i);
  const doctype = doctypeMatch ? doctypeMatch[1].trim() : null;

  // Mobile nav patterns (hamburger menu, mobile nav, etc.)
  const mobileNavPatterns = [
    /class=["'][^"']*hamburger[^"']*["']/i,
    /class=["'][^"']*menu-toggle[^"']*["']/i,
    /class=["'][^"']*mobile-menu[^"']*["']/i,
    /class=["'][^"']*nav-toggle[^"']*["']/i,
    /aria-label=["'](?:open|toggle|hamburger)\s*(?:menu|navigation)["']/i,
    /<button[^>]*aria-label=["'][^"']*(?:menu|nav)[^"']*["']/i,
    /<div[^>]*class=["'][^"']*hamburger[^"']*["']/i,
    /☰| hamburger/i,
  ];
  const hasMobileNav = mobileNavPatterns.some(p => p.test(html));

  return { hasAppleTouchIcon: appleTouchIcon, hasTapHighlightColor: tapHighlight, doctype, hasMobileNav };
}

// ============================================================
// Scoring
// ============================================================

const MAX_SCORE = 100;

function calculateScore(
  viewport: ViewportInfo,
  fonts: FontSizeInfo,
  touchTargets: TouchTargetInfo,
  responsive: ResponsiveInfo,
  hasAppleTouchIcon: boolean,
  hasTapHighlightColor: boolean,
  doctype: string | null,
  hasMobileNav: boolean
): { score: number; checks: CheckResult[]; suggestions: string[] } {
  let score = MAX_SCORE;
  const checks: CheckResult[] = [];
  const suggestions: string[] = [];

  // 1. Viewport Meta Tag (25 points)
  if (!viewport.isResponsive) {
    if (!viewport.hasWidth) {
      score -= 25;
      checks.push({
        status: 'fail',
        label: 'Viewport Meta 标签',
        detail: '页面缺少 viewport meta 标签或未设置 width=device-width',
        suggestion: '添加 <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      });
      suggestions.push('添加 viewport meta 标签并设置 width=device-width');
    } else {
      score -= 15;
      checks.push({
        status: 'fail',
        label: 'Viewport Meta 标签',
        detail: 'viewport 设置了固定宽度而非 device-width',
        suggestion: '使用 width=device-width 替代固定像素宽度',
      });
      suggestions.push('使用 width=device-width 替代固定宽度');
    }
  } else if (!viewport.hasInitialScale) {
    score -= 5;
    checks.push({
      status: 'warning',
      label: 'Viewport Meta 标签',
      detail: 'viewport 缺少 initial-scale 设置',
      suggestion: '建议添加 initial-scale=1.0 以确保正确的缩放行为',
    });
    suggestions.push('添加 initial-scale=1.0 到 viewport');
  } else {
    checks.push({
      status: 'pass',
      label: 'Viewport Meta 标签',
      detail: `已配置：${viewport.content || 'width=device-width, initial-scale=1.0'}`,
      suggestion: '✓ 已达标',
    });
  }

  // Check user-scalable=no (bad for accessibility)
  if (viewport.hasUserScalable && /user-scalable\s*=\s*no/i.test(viewport.content)) {
    score -= 5;
    checks.push({
      status: 'warning',
      label: '用户缩放',
      detail: '页面禁用了用户缩放 (user-scalable=no)',
      suggestion: '移除 user-scalable=no，或设置 minimum-scale=1.0 maximum-scale=5.0',
    });
    suggestions.push('不要禁用用户缩放，这对无障碍访问很重要');
  }

  // 2. Font Size Legibility (20 points)
  if (fonts.smallTextCount > 10) {
    score -= 20;
    checks.push({
      status: 'fail',
      label: '字体大小',
      detail: `检测到 ${fonts.smallTextCount} 处字体小于 16px，最小 ${fonts.minFontSize}px`,
      suggestion: '正文建议使用 ≥ 16px 字体，避免过小文字',
    });
    suggestions.push('将正文最小字体设为 16px，避免用户需要手动放大');
  } else if (fonts.smallTextCount > 3) {
    score -= 10;
    checks.push({
      status: 'warning',
      label: '字体大小',
      detail: `检测到 ${fonts.smallTextCount} 处字体小于 16px`,
      suggestion: '检查小字部分是否需要增大',
    });
    suggestions.push('检查小字部分是否需要增大到 16px 以上');
  } else if (fonts.smallTextCount > 0) {
    score -= 3;
    checks.push({
      status: 'warning',
      label: '字体大小',
      detail: `检测到 ${fonts.smallTextCount} 处字体略小`,
      suggestion: '建议统一使用 ≥ 16px 正文',
    });
  } else {
    checks.push({
      status: 'pass',
      label: '字体大小',
      detail: '所有检测到的内联字体大小 ≥ 16px',
      suggestion: '✓ 已达标',
    });
  }

  // If we couldn't detect any font-sizes, we're unsure
  if (fonts.totalTextElements === 0) {
    checks.push({
      status: 'warning',
      label: '字体大小',
      detail: '未检测到内联字体大小声明，无法评估',
      suggestion: '部分框架使用外部CSS，建议人工检查移动端字体渲染',
    });
  }

  // 3. Touch Target Sizing (20 points)
  const totalSmall = touchTargets.smallLinks + touchTargets.smallButtons + touchTargets.smallInputs;
  if (totalSmall > 5) {
    score -= 20;
    checks.push({
      status: 'fail',
      label: '触摸目标大小',
      detail: `检测到 ${totalSmall} 个可点击元素尺寸过小（< 48px），建议至少 48x48px`,
      suggestion: '增加按钮/链接的内边距，确保触摸目标至少 48x48px',
    });
    suggestions.push('确保所有可点击元素（按钮、链接）触摸目标 ≥ 48x48px');
  } else if (totalSmall > 0) {
    score -= 8;
    checks.push({
      status: 'warning',
      label: '触摸目标大小',
      detail: `检测到 ${totalSmall} 个可点击元素可能偏小`,
      suggestion: '检查这些元素是否满足 48x48px 推荐尺寸',
    });
    suggestions.push('检查可点击元素的触摸目标尺寸');
  } else if (touchTargets.totalLinks > 0) {
    checks.push({
      status: 'pass',
      label: '触摸目标大小',
      detail: '检测到可点击元素尺寸满足推荐标准（48x48px）',
      suggestion: '✓ 已达标',
    });
  }

  // 4. Responsive CSS (15 points)
  if (!responsive.hasMediaQueries) {
    score -= 15;
    checks.push({
      status: 'fail',
      label: '响应式 CSS',
      detail: '未检测到 CSS 媒体查询',
      suggestion: '使用 @media 查询为不同屏幕尺寸提供适配样式',
    });
    suggestions.push('添加 CSS 媒体查询以适配不同屏幕尺寸');
  } else if (responsive.mediaQueryCount < 2) {
    score -= 5;
    checks.push({
      status: 'warning',
      label: '响应式 CSS',
      detail: `仅检测到 ${responsive.mediaQueryCount} 条媒体查询，可能不足`,
      suggestion: '建议至少为手机、平板、桌面三种断点设置样式',
    });
    suggestions.push('增加媒体查询断点，覆盖手机、平板、桌面');
  } else {
    checks.push({
      status: 'pass',
      label: '响应式 CSS',
      detail: `检测到 ${responsive.mediaQueryCount} 条媒体查询`,
      suggestion: '✓ 已达标',
    });
  }

  // Flexbox/Grid bonus check
  if (!responsive.hasFlexbox && !responsive.hasGrid) {
    score -= 3;
    checks.push({
      status: 'warning',
      label: '响应式布局',
      detail: '未检测到 Flexbox 或 CSS Grid 响应式布局',
      suggestion: '使用 Flexbox 或 Grid 布局替代固定宽度布局以提高响应性',
    });
    suggestions.push('使用 Flexbox/CSS Grid 布局实现响应式设计');
  } else if (!responsive.hasFlexbox && responsive.hasGrid) {
    checks.push({
      status: 'pass',
      label: '响应式布局',
      detail: '检测到 CSS Grid 响应式布局',
      suggestion: '✓ 已达标',
    });
  } else if (responsive.hasFlexbox) {
    checks.push({
      status: 'pass',
      label: '响应式布局',
      detail: '检测到 Flexbox 弹性布局',
      suggestion: '✓ 已达标',
    });
  }

  // Fluid images
  if (!responsive.hasFluidImages) {
    score -= 5;
    checks.push({
      status: 'warning',
      label: '自适应图片',
      detail: '未检测到图片 max-width: 100% 设置',
      suggestion: '添加 img { max-width: 100%; height: auto; } 防止图片溢出',
    });
    suggestions.push('设置图片 max-width: 100% 防止在手机上溢出');
  } else {
    checks.push({
      status: 'pass',
      label: '自适应图片',
      detail: '图片设置了最大宽度 100%',
      suggestion: '✓ 已达标',
    });
  }

  // 5. iOS & Mobile Enhancements (10 points)
  if (hasAppleTouchIcon) {
    checks.push({
      status: 'pass',
      label: 'iOS 主屏图标',
      detail: '已配置 apple-touch-icon',
      suggestion: '✓ 已达标',
    });
  } else {
    score -= 3;
    checks.push({
      status: 'warning',
      label: 'iOS 主屏图标',
      detail: '缺少 apple-touch-icon',
      suggestion: '添加 <link rel="apple-touch-icon" href="/icon.png"> 提高iOS用户体验',
    });
  }

  if (hasTapHighlightColor) {
    checks.push({
      status: 'pass',
      label: '触摸高亮色',
      detail: '已配置 -webkit-tap-highlight-color',
      suggestion: '✓ 已达标',
    });
  } else {
    score -= 2;
    checks.push({
      status: 'warning',
      label: '触摸高亮色',
      detail: '未配置 -webkit-tap-highlight-color',
      suggestion: '添加 -webkit-tap-highlight-color: transparent; 提高触摸反馈',
    });
  }

  // 6. HTML5 Doctype (5 points)
  if (doctype && /html/i.test(doctype)) {
    checks.push({
      status: 'pass',
      label: 'DOCTYPE 声明',
      detail: `使用 HTML5 DOCTYPE (${doctype})`,
      suggestion: '✓ 已达标',
    });
  } else if (doctype) {
    score -= 3;
    checks.push({
      status: 'warning',
      label: 'DOCTYPE 声明',
      detail: '未使用 HTML5 DOCTYPE',
      suggestion: '使用 <!DOCTYPE html> 确保标准模式渲染',
    });
  } else {
    score -= 5;
    checks.push({
      status: 'fail',
      label: 'DOCTYPE 声明',
      detail: '页面缺少 DOCTYPE 声明',
      suggestion: '添加 <!DOCTYPE html>',
    });
  }

  // 7. Content Width & Overflow (5 points)
  if (responsive.hasOverflowHidden) {
    score -= 0; // Good, no penalty
    checks.push({
      status: 'pass',
      label: '内容溢出控制',
      detail: '检测到 overflow: hidden 设置，有助于防止水平滚动',
      suggestion: '✓ 已达标',
    });
  } else {
    score -= 3;
    checks.push({
      status: 'warning',
      label: '内容溢出控制',
      detail: '未检测到 overflow 控制',
      suggestion: '使用 overflow-x: hidden 防止移动端水平滚动',
    });
  }

  // 8. Mobile Navigation (bonus)
  if (hasMobileNav) {
    checks.push({
      status: 'pass',
      label: '移动端导航',
      detail: '检测到移动端菜单模式（汉堡菜单/侧边栏等）',
      suggestion: '✓ 已达标',
    });
  } else {
    score -= 2;
    checks.push({
      status: 'warning',
      label: '移动端导航',
      detail: '未检测到移动端专用的导航模式',
      suggestion: '在移动端使用汉堡菜单或折叠导航以提高可用性',
    });
  }

  return {
    score: Math.max(0, Math.round(score)),
    checks,
    suggestions,
  };
}

// ============================================================
// Main Analysis
// ============================================================

async function analyzeUrl(targetUrl: string): Promise<AnalysisResult> {
  const normalizedUrl = normalizeUrl(targetUrl);
  const domain = extractDomain(normalizedUrl);

  // Fetch the page
  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  const html = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const finalUrl = response.url;

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`目标 URL 返回 ${contentType} 而非 HTML 页面`);
  }

  // 1. Viewport analysis
  const { viewport: viewportData, metaRaw } = analyzeViewport(html);

  // 2. Font sizes
  const fontData = analyzeFontSizes(html);

  // 3. Touch targets
  const touchData = analyzeTouchTargets(html);

  // 4. Responsive CSS
  const responsiveData = analyzeResponsiveCSS(html);

  // 5. HTML structure
  const structData = analyzeHTMLStructure(html);

  // 6. Calculate score
  const { score, checks, suggestions } = calculateScore(
    viewportData,
    fontData,
    touchData,
    responsiveData,
    structData.hasAppleTouchIcon,
    structData.hasTapHighlightColor,
    structData.doctype,
    structData.hasMobileNav
  );

  return {
    url: finalUrl,
    score,
    checks,
    details: {
      viewport: viewportData,
      fonts: fontData,
      touchTargets: touchData,
      responsive: responsiveData,
      hasAppleTouchIcon: structData.hasAppleTouchIcon,
      hasTapHighlightColor: structData.hasTapHighlightColor,
      metaViewportRaw: metaRaw,
      doctype: structData.doctype,
      hasMobileNav: structData.hasMobileNav,
    },
    suggestions,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');

  if (!urlParam || !urlParam.trim()) {
    return NextResponse.json(
      { error: '请提供要检测的 URL' },
      { status: 400 }
    );
  }

  try {
    // Validate URL format
    const testUrl = normalizeUrl(urlParam);
    new URL(testUrl);

    const result = await analyzeUrl(urlParam);
    return NextResponse.json(result);
  } catch (err: any) {
    const message = err.message || '检测过程中发生错误';

    // Handle specific error types
    if (message.includes('fetch') || message.includes('fetch failed')) {
      return NextResponse.json(
        { error: `无法访问目标页面，请检查 URL 是否正确或目标网站是否可访问` },
        { status: 502 }
      );
    }

    if (message.includes('Invalid URL') || message.includes('Invalid protocol')) {
      return NextResponse.json(
        { error: 'URL 格式无效，请输入有效的网址' },
        { status: 400 }
      );
    }

    if (message.includes('aborted') || message.includes('timeout')) {
      return NextResponse.json(
        { error: '请求超时（15秒），目标页面加载时间过长' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
