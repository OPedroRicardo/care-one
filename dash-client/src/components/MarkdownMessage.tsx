import ReactMarkdown from 'react-markdown'
import remarkGfm    from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

  // Headings
  h1: ({ children }) => <h1 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0">{children}</h3>,

  // Lists
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Inline emphasis
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em:     ({ children }) => <em className="italic">{children}</em>,

  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto mb-2">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-slate-200 text-slate-800 rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    )
  },

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#0079C8] pl-3 italic text-slate-600 mb-2">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="border-slate-300 my-2" />,

  // ── Tables (GFM) ──────────────────────────────────────────────────────────

  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-[#0079C8] text-white">{children}</thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-200">{children}</tbody>
  ),

  tr: ({ children }) => (
    <tr className="even:bg-slate-50 transition-colors">{children}</tr>
  ),

  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{children}</th>
  ),

  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-700">{children}</td>
  ),
}

interface Props {
  content: string
  /** Render a blinking cursor after the last character (used while streaming). */
  streaming?: boolean
}

export default function MarkdownMessage({ content, streaming = false }: Props) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-[2px] h-[1em] ml-[1px] bg-slate-500 align-middle animate-[blink_0.9s_step-end_infinite]" />
      )}
    </div>
  )
}
