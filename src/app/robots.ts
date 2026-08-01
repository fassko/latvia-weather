import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexableDeployment } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // JSON endpoints and the assistant stream are not useful search results.
      disallow: ["/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
