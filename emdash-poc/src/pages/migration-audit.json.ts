import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

export const GET: APIRoute = async () => {
  const { entries } = await getEmDashCollection("pages", { limit: 100, orderBy: { created_at: "asc" } });
  const rows = entries.map((page: any) => {
    const serialized = JSON.stringify(page.data.content ?? []);
    return {
      slug: page.id,
      title: page.data.title,
      status: page.data.status,
      blocks: Array.isArray(page.data.content) ? page.data.content.length : 0,
      chars: serialized.length,
      htmlBlocks: (serialized.match(/html/gi) ?? []).length,
      elementorRefs: (serialized.match(/elementor/gi) ?? []).length,
      shortcodes: (serialized.match(/\[[a-zA-Z_][^\]]*\]/g) ?? []).length,
      sourceImages: serialized.split("https://cropri.com/wp-content/uploads").length - 1,
    };
  });
  return Response.json({ count: rows.length, pages: rows });
};
