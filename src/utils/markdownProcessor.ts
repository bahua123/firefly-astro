import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkSectionize from 'remark-sectionize';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeExternalLinks from '../plugins/rehype-external-links.mjs';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import katex from 'katex';
import { parseDirectiveNode } from '../plugins/remark-directive-rehype';
import { siteConfig } from '../config/siteConfig';

import rehypeCallouts from 'rehype-callouts';

export interface ProcessedMarkdown {
    html: string;
    headings: Array<{ depth: number; slug: string; text: string }>;
    wordCount: number;
    readingTime: number;
}

export async function processMarkdown(content: string): Promise<ProcessedMarkdown> {
    const processor = unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkDirective)
        .use(remarkSectionize)
        .use(parseDirectiveNode)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeKatex, { katex })
        .use(rehypeCallouts, { theme: siteConfig.rehypeCallouts.theme })
        .use(rehypeSlug)
        .use(rehypeExternalLinks, { 
            siteUrl: siteConfig.site_url,
            target: '_blank',
            rel: ['noopener', 'noreferrer']
        })
        .use(rehypeStringify, { allowDangerousHtml: true });

    const result = await processor.process(content);
    const html = result.toString();

    const headings: Array<{ depth: number; slug: string; text: string }> = [];
    const headingRegex = /<h([1-6]) id="([^"]*)">([^<]*)<\/h[1-6]>/g;
    let match: RegExpExecArray | null = headingRegex.exec(html);
    while (match !== null) {
        headings.push({
            depth: Number.parseInt(match[1]),
            slug: match[2],
            text: match[3]
        });
        match = headingRegex.exec(html);
    }

    const textContent = content.replace(/[#*`\[\]()]/g, '').trim();
    const wordCount = textContent.length;
    const readingTime = Math.ceil(wordCount / 1000);

    return {
        html,
        headings,
        wordCount,
        readingTime
    };
}
