import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

export function AcademicContent({ children }: { children: string }) {
  return <div className="academic-prose min-w-0 break-words text-slate-700">
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore' }], rehypeHighlight]}
      components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        img: () => <span className="text-sm text-slate-500">[Imagem externa não exibida]</span>,
      }}
    >{children}</ReactMarkdown>
  </div>;
}
