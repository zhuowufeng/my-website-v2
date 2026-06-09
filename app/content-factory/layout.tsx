// /content-factory/layout
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "内容工厂 | SEO Content Factory | Sinmoniker",
  description: "AI驱动的SEO内容工厂：发现话题、批量生成、自动发布、追踪效果",
};

export default function ContentFactoryLayout({ children }) {
  return <>{children}</>;
}
