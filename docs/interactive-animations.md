# 🎭 交互动效 — Hover/过渡/加载/微交互

> 学完时间：2026-06-07 03:56  
> 目标：让所有产品按钮有反馈、过渡流畅、加载优雅

---

## 一、核心理念

### 1.1 为什么交互动效重要？

```
好动效让用户觉得「这个网站很专业」
坏动效（或没有动效）让用户觉得「卡了/坏了」
```

- **反馈**：用户每次操作都要有即时视觉反馈
- **流畅**：状态切换不突兀，用过渡消除跳跃感
- **专业**：精致微交互提升整体产品质感
- **引导**：动效引导用户注意力到正确位置

### 1.2 动效三原则

1. **克制** — 动效不是越多越好，每个动效要有目的
2. **快速** — 大部分动效 150-300ms，超过 500ms 就嫌慢
3. **自然** — 用 ease-out 模拟物理运动，不要 linear

---

## 二、Tailwind v4 过渡体系

### 2.1 基础过渡

```tsx
// 一句话让所有属性变化有过渡
<button className="transition-all duration-200 ease-out">
```

| 工具类 | 作用 |
|--------|------|
| `transition` | 过渡所有可动画属性 (默认 150ms ease) |
| `transition-all` | 同上，明确声明 |
| `transition-colors` | 只过渡颜色 (background, color, border-color) |
| `transition-opacity` | 只过渡透明度 |
| `transition-shadow` | 只过渡阴影 |
| `transition-transform` | 只过渡变换 |

### 2.2 时间和缓动

```tsx
<button className="transition-all duration-300 ease-out">
```

**时间：** `duration-75` → `100` → `150` → `200` → `300` → `500` → `700` → `1000`

**缓动函数：** `ease-linear` | `ease-in` | `ease-out` | `ease-in-out`

💡 **黄金组合：** `duration-200 ease-out` — 200ms，快入慢出，最自然

### 2.3 延迟过渡

```tsx
// 鼠标移入后延迟 100ms 再触发
<div className="transition-opacity delay-100 duration-200">
```

---

## 三、Hover/Active/Focus 效果集

### 3.1 按钮效果

```tsx
// 标准按钮 — 颜色变化 + 轻微缩小（按压感）
<button className="
  bg-amber-600 text-white
  hover:bg-amber-700
  active:scale-[0.97]
  transition-all duration-150 ease-out
  cursor-pointer
">
  按钮
</button>

// 幽灵/文字按钮 — 背景淡入
<button className="
  text-teal-600
  hover:bg-teal-50
  active:bg-teal-100
  transition-colors duration-150
">
  文字按钮
</button>
```

### 3.2 卡片效果

```tsx
// 卡片悬浮 — 轻微上移 + 阴影加深
<div className="
  bg-white rounded-xl border border-gray-200 shadow-sm
  hover:shadow-md hover:-translate-y-0.5
  transition-all duration-200 ease-out
">
  {/* 卡片内容 */}
</div>
```

### 3.3 链接效果

```tsx
// 链接 — 颜色过渡
<Link className="
  text-teal-600
  hover:text-teal-800
  transition-colors duration-150
">
  链接
</Link>

// 带下划线动画
<a className="
  relative inline-block
  after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-current
  hover:after:w-full
  after:transition-all after:duration-200
">
  链接文字
</a>
```

### 3.4 输入框效果

```tsx
<input className="
  border border-gray-300 rounded-lg
  focus:ring-2 focus:ring-teal-500 focus:border-teal-500
  outline-none
  transition-all duration-150
"/>
```

---

## 四、CSS 动画（@keyframes + Tailwind v4）

### 4.1 Tailwind 内置动画

| 动画 | 作用 | 使用 |
|------|------|------|
| `animate-spin` | 旋转 | 加载图标 |
| `animate-pulse` | 脉冲淡入淡出 | 骨架屏、光标 |
| `animate-ping` | 波纹扩散 | 通知、新消息 |
| `animate-bounce` | 弹跳 | 彩蛋、趣味效果 |

### 4.2 Tailwind v4 自定义动画

```css
/* globals.css */
@theme {
  /* 定义关键帧 */
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-slide-in-right: slide-in-right 0.3s ease-out;
  --animate-scale-in: scale-in 0.2s ease-out;
  --animate-shimmer: shimmer 2s infinite;
  --animate-progress: progress 2s ease-out;
}

/* 然后在 @keyframes 区块定义关键帧 */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}
```

使用自定义动画：

```tsx
<div className="animate-fade-in">淡入内容</div>
<div className="animate-slide-up">上滑内容</div>
<div className="animate-scale-in">缩放进入</div>
```

### 4.3 单次 vs 无限循环

```tsx
// 默认 = 只执行一次
<div className="animate-fade-in">

// 无限循环 = 加 infinite
<div className="animate-pulse">
<div className="animate-spin">
<div className="animate-shimmer">
```

---

## 五、加载状态设计

### 5.1 骨架屏 (Skeleton)

```tsx
// 最简骨架屏
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-gray-200 rounded w-3/4" />
  <div className="h-4 bg-gray-200 rounded w-1/2" />
  <div className="h-10 bg-gray-200 rounded w-full" />
</div>

// 高级骨架屏 - shimmer效果
<div className="relative overflow-hidden bg-gray-100 rounded-lg">
  {/* 顶部色条 */}
  <div className="h-2 bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600" />
  <div className="p-4 space-y-3">
    <div className="h-3 bg-gray-200 rounded w-16" />
    <div className="h-7 bg-gray-200 rounded w-28" />
    <div className="h-4 bg-gray-200 rounded w-20" />
    <div className="h-4 bg-gray-200 rounded w-full" />
    <div className="h-4 bg-gray-200 rounded w-3/4" />
  </div>
</div>
```

### 5.2 按钮加载态

```tsx
<button disabled={isLoading}>
  {isLoading ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      加载中...
    </span>
  ) : '提交'}
</button>
```

### 5.3 进度条

```tsx
// 顶部全局进度条
<div className="fixed top-0 left-0 w-full h-1 bg-teal-500 z-50 animate-progress" />
```

### 5.4 光标闪烁

```tsx
// 打字机效果末尾光标
<span className="inline-block w-[3px] h-[1.2em] bg-teal-600 animate-pulse ml-0.5 align-middle" />
```

---

## 六、微交互实战模式

### 6.1 页面进入动画

```tsx
// 整体页面 content 淡入上滑
<main className="animate-fade-in">
  {/* 页面内容 */}
</main>

// 或者对特定区域应用
<div className="animate-slide-up">
```

### 6.2 卡片列表交错进入

```css
/* globals.css */
@theme {
  --animate-fade-in-up: fade-in-up 0.4s ease-out;
  --animate-fade-in-up-delay-1: fade-in-up 0.4s ease-out 0.1s both;
  --animate-fade-in-up-delay-2: fade-in-up 0.4s ease-out 0.2s both;
  --animate-fade-in-up-delay-3: fade-in-up 0.4s ease-out 0.3s both;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

```tsx
// 组件内使用
<div className="animate-fade-in-up">卡片 1</div>
<div className="animate-fade-in-up-delay-1">卡片 2</div>
<div className="animate-fade-in-up-delay-2">卡片 3</div>
```

### 6.3 通知/提示出现

```tsx
// 保存成功提示
<div className="
  fixed bottom-4 right-4 bg-green-50 border border-green-200 p-3 rounded-lg
  animate-slide-up
">
  ✅ 保存成功
</div>
```

### 6.4 悬浮按钮 + 工具提示

```tsx
<button className="group relative">
  <span className="icon">?</span>
  {/* 提示文字：默认隐藏，hover 显示 */}
  <span className="
    absolute -top-8 left-1/2 -translate-x-1/2
    bg-gray-800 text-white text-xs px-2 py-1 rounded
    opacity-0 group-hover:opacity-100
    transition-opacity duration-150
    whitespace-nowrap
  ">
    帮助信息
  </span>
</button>
```

### 6.5 复制成功反馈

```tsx
const [copied, setCopied] = useState(false);

<button onClick={() => {
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}}
  className={`
    px-3 py-1.5 rounded-lg text-xs font-medium
    transition-all duration-150
    ${copied
      ? 'bg-green-100 text-green-700 scale-105'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }
  `}
>
  {copied ? '✅ 已复制' : '📋 复制'}
</button>
```

---

## 七、动效性能优化

### 7.1 GPU 加速属性（优先使用）

```
✅ transform (translate, scale, rotate) — GPU 加速
✅ opacity — GPU 加速
✅ filter — 部分 GPU 加速
❌ width / height / top / left — 触发重排 (reflow)
❌ margin / padding — 触发重排
❌ box-shadow 变化 — 触发重绘
```

**最佳实践：**
- 用 `translateY` 代替 `top` 做位移动画
- 用 `scale` 代替 `width/height` 做缩放动画
- opacity 任意用，没有性能问题
- 组合 transform + opacity 做进场动画

### 7.2 减少动画范围

```tsx
// ❌ 不好：过渡所有属性
<button className="transition-all duration-200">

// ✅ 好：只过渡需要的属性
<button className="transition-colors duration-150">
<button className="transition-transform duration-150">
```

### 7.3 prefers-reduced-motion

```css
/* 尊重用户系统设置 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 八、当前产品动效审计

### ✅ 已经有的动效
| 位置 | 效果 | 评价 |
|------|------|------|
| 导航栏 | 半透明背景 `backdrop-blur-sm` | ✅ 好 |
| 所有 Link | `transition-colors` | ✅ 基础 |
| 按钮 hover | `bg-hover` 变化 | ✅ 基础 |
| 生成按钮 | `active:scale-[0.98]` | ✅ 好 |
| 复制按钮 | 颜色切换 + 文字变化 | ✅ 好 |
| 导航 Link | `hover:opacity-80` | ✅ 轻量 |
| 历史侧栏 | 移动端 `fixed` 覆盖层 | ⚠️ 没有入场动画 |
| 骨架屏 | `animate-pulse` | ✅ 好 |
| 旋转图标 | `animate-spin` | ✅ 好 |
| 打字机光标 | `animate-pulse` | ✅ 好 |

### ❌ 需要改进的地方
| 位置 | 需要什么 | 优先级 |
|------|---------|--------|
| Landing Page 名字切换 | 淡入过渡（现在是硬切） | 🔴 高 |
| 页面内容进场 | 没有 fade-in/slide-up | 🔴 高 |
| 卡片 hover | 轻微上移 + 阴影加深 | 🟡 中 |
| 按钮 active | 统一 scale-down 按压感 | 🟡 中 |
| 历史侧栏弹出 | 滑动入场动画 | 🟡 中 |
| 保存成功提示 | 没有动画 | 🟢 低 |
| 结果卡片加载 | 骨架屏可以更精致 | 🟢 低 |
| 导航菜单项 hover | 背景淡入 + 文字变化 | 🟢 低 |

---

## 九、完成标准

- [x] 所有按钮有 hover + active 反馈
- [x] 所有卡片有 hover 上浮效果
- [x] 页面内容有淡入入场动画
- [x] 名字轮播有淡入过渡
- [x] 侧栏历史有滑动入场
- [x] 所有链接有颜色过渡
- [x] 加载态统一使用骨架屏/spinner
- [x] 动效性能优化（只用 transform/opacity）
- [x] `prefers-reduced-motion` 支持
- [x] 构建通过
