// JSON-LD Structured Data for SEO
// Adds Schema.org markup for better search results (rich snippets)

type JsonLdProps = {
  data: Record<string, unknown>;
};

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// --- Structured Data Builders ---

export function siteNavigationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sinmoniker",
    alternateName: "墨言AI写作助手",
    url: "https://sinmoniker.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://sinmoniker.com/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function softwareAppLd({
  name,
  description,
  url,
  operatingSystem = "Web",
  applicationCategory = "WebApplication",
}: {
  name: string;
  description: string;
  url: string;
  operatingSystem?: string;
  applicationCategory?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    url,
    operatingSystem,
    applicationCategory,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
      availability: "https://schema.org/InStock",
    },
  };
}

// --- Enhanced Schema Types for SEO ---

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sinmoniker",
    alternateName: "墨言AI写作助手",
    url: "https://sinmoniker.com",
    logo: "https://sinmoniker.com/og-image.png",
    description: "Discover your Chinese name with AI. Free tools for SEO diagnosis, keyword research, AI writing, and website analysis.",
    foundingDate: "2025",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://sinmoniker.com"
    },
    sameAs: [
      "https://sinmoniker.com/blog",
      "https://sinmoniker.com/seo-diagnosis"
    ]
  };
}

export function orgSchema() {
  return <JsonLd data={organizationLd()} />;
}

export function faqPageLd(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

export function howToLd({
  name,
  description,
  steps,
  totalTime,
}: {
  name: string;
  description: string;
  steps: { name: string; text: string; url?: string }[];
  totalTime?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    totalTime: totalTime || "PT2M",
    step: steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
      url: step.url,
    })),
  };
}

export function webPageLd({
  name,
  description,
  url,
  image,
  datePublished,
  dateModified,
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    image: image || "https://sinmoniker.com/og-image.png",
    datePublished: datePublished || new Date().toISOString().split("T")[0],
    dateModified: dateModified || new Date().toISOString().split("T")[0],
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://sinmoniker.com" },
      ],
    },
    about: {
      "@type": "Thing",
      name: "Sinmoniker - Chinese Name Generator & SEO Tools",
    },
  };
}

export function productLd({
  name,
  description,
  url,
  image,
  brand = "Sinmoniker",
  offers,
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  brand?: string;
  offers?: { price: string; priceCurrency: string; availability?: string };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    image: image || "https://sinmoniker.com/og-image.png",
    brand: {
      "@type": "Brand",
      name: brand,
    },
    offers: {
      "@type": "Offer",
      price: offers?.price || "0",
      priceCurrency: offers?.priceCurrency || "CNY",
      availability: offers?.availability || "https://schema.org/InStock",
      url,
    },
  };
}

export function blogPostLd({
  title,
  description,
  url,
  datePublished,
  authorName = "Sinmoniker",
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  authorName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    datePublished,
    dateModified: datePublished,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "Sinmoniker",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}
