#!/usr/bin/env node
/**
 * Build a single MD file to HTML using the project's template + sidebar.
 * Usage: node build-one.js <relative-md-path>
 *   e.g. node build-one.js docs/02-modules/01-module-architecture.md
 *
 * Output goes to dist/<subdir>/<filename without .md>.html
 *   e.g. dist/02-modules/01-module-architecture.html
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const root = __dirname;
const mdRel = process.argv[2];
if (!mdRel) {
  console.error('Usage: node build-one.js <relative-md-path>');
  console.error('  e.g. node build-one.js docs/02-architecture/01-module-architecture.md');
  process.exit(1);
}

const mdPath = path.join(root, mdRel);
if (!fs.existsSync(mdPath)) {
  console.error(`✗ Source not found: ${mdRel}`);
  process.exit(1);
}

// ---- marked setup ----
marked.setOptions({ gfm: true, breaks: true });
const renderer = new marked.Renderer();
renderer.code = function (token) {
  const code = token.text || String(token);
  const language = token.lang || '';
  if (language === 'mermaid') {
    const normalized = code.replace(/<br\s*\/?>/gi, '\n');
    return `<div class="mermaid">${normalized}</div>`;
  }
  const langClass = language ? ` class="language-${language}"` : '';
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre><code${langClass}>${escaped}</code></pre>`;
};
marked.use({ renderer });

function fixLinks(html) {
  return html
    .replace(/href="\.\/([^"]+)"/g, (m, p) => `href="${p}.html"`)
    .replace(/href="(\.\.\/[^"]+)"/g, (m, p) => `href="${p}.html"`)
    .replace(/href="(\/docs\/[^"]+)"/g, (m, p) => `href="${p}.html"`)
    .replace(/href="(\/[^"]+)"/g, (m, p) => `href="${p}.html"`);
}

// ---- sidebar parser ----
const arrowSVG = `<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
function parseSidebar(mdSidebarPath) {
  if (!fs.existsSync(mdSidebarPath)) return '';
  const lines = fs.readFileSync(mdSidebarPath, 'utf8').split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    if (line.trim() === '---') {
      if (inList) { html += '</ul></div></div>'; inList = false; }
      continue;
    }
    if (line.startsWith('# ')) continue;
    const sectionMatch = line.trim().match(/^\* \*\*(\d+)\.\s+(.+?)\*\*$/);
    if (sectionMatch) {
      if (inList) html += '</ul></div></div>';
      html += `<div class="sidebar-section" data-section="${sectionMatch[1]}">
        <div class="sidebar-section-header">
          <span class="section-title">
            <span class="section-num">${sectionMatch[1]}</span>
            <span class="section-name">${sectionMatch[2]}</span>
          </span>
          ${arrowSVG}
        </div>
        <div class="sidebar-section-items"><ul>`;
      inList = true;
    } else if (line.trim().startsWith('* [') && inList) {
      const linkMatch = line.trim().match(/\* \[([^\]]+)\]\(([^\)]+)\)/);
      if (linkMatch) {
        const text = linkMatch[1];
        let href = linkMatch[2];
        if (href.startsWith('/')) {
          href = href.replace(/^\/docs\//, '/');
          href += '.html';
        } else if (!href.startsWith('http')) {
          href += '.html';
        }
        html += `<li><a href="${href}"><span class="dot"></span>${text}</a></li>`;
      }
    }
  }
  if (inList) html += '</ul></div></div>';
  return html;
}

// ---- main ----
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const md = fs.readFileSync(mdPath, 'utf8');
let body = marked(md);
body = fixLinks(body);

const pageTitle = md.match(/^#\s+(.+)$/m)?.[1] || 'Document';

// Resolve sidebar: use section-specific _sidebar.md if exists
const sectionDir = path.dirname(mdRel);  // e.g. "docs/02-modules"
const sectionSidebar = parseSidebar(path.join(root, sectionDir, '_sidebar.md'));
const rootSidebar = parseSidebar(path.join(root, 'docs', '_sidebar.md'));
const sidebar = sectionSidebar || rootSidebar;

// Output: dist/<section>/<name>.html  e.g. dist/02-modules/01-module-architecture.html
const outRel = mdRel
  .replace(/^docs\//, '') // strip "docs/" prefix
  .replace(/\.md$/, '.html');
const outPath = path.join(root, 'dist', outRel);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const page = template
  .replace('{{TITLE}}', pageTitle)
  .replace('{{CONTENT}}', body)
  .replace('{{SIDEBAR}}', sidebar);

fs.writeFileSync(outPath, page, 'utf8');

const mermaidCount = (body.match(/class="mermaid"/g) || []).length;
const lines = page.split('\n').length;
const bytes = fs.statSync(outPath).size;
console.log(`✓ ${outRel}`);
console.log(`  mermaid blocks: ${mermaidCount}`);
console.log(`  lines: ${lines} | bytes: ${bytes.toLocaleString()}`);
