# astro-md-alternate

Serve markdown versions of your Astro content pages for AI agents and LLMs.

Websites have always been built for two audiences: humans and search engines. AI agents are now the **third audience**, and most websites aren't optimized for them. This integration fixes that by making your content available as clean markdown alongside HTML.

## What it does

- Generates a `.md` endpoint for each page in your content collections (e.g. `/post/my-article.md`)
- Provides a `<MarkdownAlternateLink>` component that adds `<link rel="alternate" type="text/markdown">` to your HTML `<head>` for auto-discovery
- Strips MDX-specific syntax (imports, JSX components) to produce clean, readable markdown
- Works at build time with static output -- no server required

## Install

```bash
npm install astro-md-alternate
```

## Setup

### 1. Add the integration

```js
// astro.config.mjs
import mdAlternate from "astro-md-alternate";

export default defineConfig({
  integrations: [
    mdAlternate({
      collections: [
        { name: "post", pattern: "/post/[slug]" },
      ],
    }),
  ],
});
```

### 2. Add the auto-discovery link

In your `<head>` layout (e.g. `BaseHead.astro` or `BaseLayout.astro`):

```astro
---
import { MarkdownAlternateLink } from "astro-md-alternate/components";
---

<head>
  <!-- your existing head content -->
  <MarkdownAlternateLink patterns={["/post/"]} />
</head>
```

That's it. Your blog posts now have markdown versions that AI agents can discover and consume.

## Configuration

### Integration options

```ts
mdAlternate({
  collections: [
    {
      // Required: content collection name
      name: "post",
      // Required: URL pattern matching your page route
      pattern: "/post/[slug]",
      // Optional: frontmatter fields to include (defaults shown below)
      fields: ["title", "description", "pubDate", "updatedDate", "authors", "categories"],
    },
    // Add multiple collections
    {
      name: "docs",
      pattern: "/docs/[slug]",
      fields: ["title", "description", "lastUpdated"],
    },
  ],
  // Optional: strip MDX syntax from output (default: true)
  stripMdx: true,
});
```

### Component props

```astro
<!-- Only add the link tag on pages matching these path prefixes -->
<MarkdownAlternateLink patterns={["/post/", "/docs/"]} />

<!-- Add to all pages (no filtering) -->
<MarkdownAlternateLink />
```

## How it works

1. At build time, the integration generates a static API endpoint for each entry in your configured content collections
2. Requesting `/post/my-article.md` returns the post's content as clean markdown with YAML frontmatter
3. The `<MarkdownAlternateLink>` component renders a `<link rel="alternate" type="text/markdown">` tag that crawlers use for auto-discovery (similar to RSS `<link>` tags)

### Example output

Requesting `https://example.com/post/my-article.md` returns:

```markdown
---
title: "My Article"
description: "A description of the article"
date: 2025-01-15
authors: [jane]
categories: [Tech, AI]
url: https://example.com/post/my-article/
---

The full markdown body of your article, with MDX imports
and JSX components automatically stripped for readability.
```

## Background

This implements the ["third audience" pattern](https://dri.es/the-third-audience) described by Dries Buytaert, providing the same features as WordPress's [Markdown Alternate](https://github.com/progressplanner/markdown-alternate) plugin but for Astro sites.

## License

MIT
