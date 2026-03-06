import type { AstroIntegration } from "astro";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface CollectionConfig {
  /** Content collection name (e.g. "post", "blog") */
  name: string;
  /** URL pattern matching your page route (e.g. "/post/[slug]") */
  pattern: string;
  /**
   * Frontmatter fields to include in the markdown output.
   * Defaults to: ["title", "description", "pubDate", "updatedDate", "authors", "categories"]
   */
  fields?: string[];
}

export interface MdAlternateOptions {
  /** Content collections to generate markdown endpoints for */
  collections: CollectionConfig[];
  /**
   * Fields to strip from MDX body (e.g. import statements, JSX components).
   * Set to false to disable stripping. Defaults to true.
   */
  stripMdx?: boolean;
}

const DEFAULT_FIELDS = [
  "title",
  "description",
  "pubDate",
  "updatedDate",
  "authors",
  "categories",
];

/**
 * Generate the endpoint source code for a given collection.
 * This creates a standalone Astro API route file.
 */
function generateEndpoint(
  collection: CollectionConfig,
  site: string | undefined,
  stripMdx: boolean,
): string {
  const fields = collection.fields ?? DEFAULT_FIELDS;
  // Extract the param name from the pattern (e.g. "/post/[slug]" -> "slug")
  const paramMatch = collection.pattern.match(/\[([^\]]+)\]/);
  const paramName = paramMatch?.[1] ?? "slug";
  // Build the base path (e.g. "/post/[slug]" -> "/post/")
  const basePath =
    collection.pattern.slice(0, collection.pattern.indexOf("[")) || "/";

  return `import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection("${collection.name}", ({ data }) => !data.draft);
  return entries.map((entry) => ({
    params: { ${paramName}: entry.slug },
    props: { entry },
  }));
};

function formatDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
}

${
  stripMdx
    ? `function cleanBody(body) {
  if (!body) return "";
  return body
    .split("\\n")
    .filter((line) => !line.match(/^import\\s+.*from\\s+["']/))
    .filter((line) => !line.match(/^<[A-Z]\\w*\\s[^>]*\\/?>\\s*$/))
    .filter((line) => !line.match(/^<\\/[A-Z]\\w*\\s*>\\s*$/))
    .join("\\n")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();
}`
    : `function cleanBody(body) { return body ?? ""; }`
}

export const GET: APIRoute = ({ props }) => {
  const { entry } = props;
  const data = entry.data;

  const lines = [];
${fields
  .map((field) => {
    if (field === "title") {
      return `  if (data.title) lines.push('title: "' + data.title.replace(/"/g, '\\\\"') + '"');`;
    }
    if (field === "description") {
      return `  if (data.description) lines.push('description: "' + data.description.replace(/"/g, '\\\\"') + '"');`;
    }
    if (field === "pubDate") {
      return `  if (data.pubDate) lines.push("date: " + formatDate(data.pubDate));`;
    }
    if (field === "updatedDate") {
      return `  if (data.updatedDate) lines.push("updated: " + formatDate(data.updatedDate));`;
    }
    if (field === "authors") {
      return `  if (data.authors?.length) lines.push("authors: [" + data.authors.join(", ") + "]");`;
    }
    if (field === "categories") {
      return `  if (data.categories?.length) lines.push("categories: [" + data.categories.join(", ") + "]");`;
    }
    // Generic field handling
    return `  if (data.${field} != null) lines.push("${field}: " + JSON.stringify(data.${field}));`;
  })
  .join("\n")}
  lines.push("url: ${site ? site.replace(/\/$/, "") : ""}${basePath}" + entry.slug + "/");

  const frontmatter = "---\\n" + lines.join("\\n") + "\\n---";
  const body = cleanBody(entry.body);
  const markdown = frontmatter + "\\n\\n" + body + "\\n";

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
`;
}

export default function mdAlternate(
  options: MdAlternateOptions,
): AstroIntegration {
  const stripMdx = options.stripMdx ?? true;

  return {
    name: "astro-md-alternate",
    hooks: {
      "astro:config:setup": async ({ config, injectRoute, logger }) => {
        const cacheDir = join(
          config.root.pathname,
          "node_modules",
          ".astro-md-alternate",
        );
        await mkdir(cacheDir, { recursive: true });

        for (const collection of options.collections) {
          const paramMatch = collection.pattern.match(/\[([^\]]+)\]/);
          const paramName = paramMatch?.[1] ?? "slug";

          // Generate the route pattern: "/post/[slug]" -> "/post/[slug].md"
          const routePattern =
            collection.pattern.replace(`[${paramName}]`, `[${paramName}]`) +
            ".md";

          // Write the generated endpoint file
          const endpointFile = join(
            cacheDir,
            `${collection.name}-endpoint.ts`,
          );
          const endpointCode = generateEndpoint(
            collection,
            config.site?.toString(),
            stripMdx,
          );
          await writeFile(endpointFile, endpointCode);

          injectRoute({
            pattern: routePattern,
            entrypoint: endpointFile,
            prerender: true,
          });

          logger.info(
            `Registered markdown endpoint: ${routePattern} (collection: ${collection.name})`,
          );
        }
      },
    },
  };
}
