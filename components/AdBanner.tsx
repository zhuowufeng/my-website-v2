/**
 * AdBanner — 广告位组件
 *
 * 策略：
 * - 在诊断结果下方、批量页、历史页等页面展示
 * - 支持自定义文案（可根据页面上下文调整）
 * - 后期接入真实广告联盟时只需替换链接
 */

'use client';

interface AdBannerProps {
  position?: 'bottom' | 'sidebar' | 'inline';
  source?: string;
}

const ADS: Record<string, { icon: string; title: string; desc: string; cta: string }[]> = {
  default: [
    {
      icon: '🔥',
      title: 'SEO 优化服务',
      desc: '专业网站SEO诊断 + 优化方案，提升百度排名',
      cta: '了解更多',
    },
    {
      icon: '💻',
      title: '网站建设',
      desc: '从0到1搭建高性能网站，支持流量变现',
      cta: '免费咨询',
    },
  ],
  seo: [
    {
      icon: '📈',
      title: '持续SEO监控',
      desc: '定时诊断、趋势追踪、竞品分析 — 一站式SEO平台',
      cta: '查看仪表盘',
    },
    {
      icon: '⚡',
      title: '批量诊断升级',
      desc: '一次分析50个页面，SSE实时进度，CSV导出报告',
      cta: '升级 Pro',
    },
  ],
};

export default function AdBanner({ position = 'bottom', source = 'default' }: AdBannerProps) {
  const ads = ADS[source] || ADS.default;
  const ad = ads[0]; // Show first ad

  const isSidebar = position === 'sidebar';

  return (
    <div className={`
      rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50
      ${isSidebar ? 'p-4' : 'p-5'}
    `}>
      <div className={`flex items-center gap-4 ${isSidebar ? 'flex-col text-center' : ''}`}>
        <div className="text-2xl flex-shrink-0">{ad.icon}</div>
        <div className={`flex-1 ${isSidebar ? '' : ''}`}>
          <h4 className="text-sm font-semibold text-gray-800">{ad.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{ad.desc}</p>
        </div>
        <button
          onClick={() => {
            // Future: real ad link or affiliate redirect
            alert('🚀 功能即将开放');
          }}
          className={`
            flex-shrink-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white 
            text-xs font-medium rounded-lg hover:from-indigo-700 hover:to-blue-700 
            transition-all shadow-sm whitespace-nowrap
            ${isSidebar ? 'w-full py-2' : 'px-4 py-2'}
          `}
        >
          {ad.cta} →
        </button>
      </div>
    </div>
  );
}
