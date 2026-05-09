import React from 'react'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Simple markdown rendering
  const renderContent = () => {
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeContent = ''
    let codeLang = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Code block start/end
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="code-block">
              <code>{codeContent}</code>
            </pre>
          )
          codeContent = ''
          codeLang = ''
          inCodeBlock = false
        } else {
          codeLang = line.slice(3).trim()
          inCodeBlock = true
        }
        continue
      }

      if (inCodeBlock) {
        codeContent += line + '\n'
        continue
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="md-h1">{line.slice(2)}</h1>)
        continue
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="md-h2">{line.slice(3)}</h2>)
        continue
      }
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="md-h3">{line.slice(4)}</h3>)
        continue
      }

      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<li key={i} className="md-li">{renderInline(line.slice(2))}</li>)
        continue
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s/)
      if (numberedMatch) {
        elements.push(<li key={i} className="md-li">{renderInline(line.slice(numberedMatch[0].length))}</li>)
        continue
      }

      // Bold and italic
      elements.push(<p key={i} className="md-p">{renderInline(line)}</p>)
    }

    return elements
  }

  const renderInline = (text: string): React.ReactNode => {
    // Process inline formatting
    let result = text
    
    // Bold: **text**
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text*
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code: `code`
    result = result.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')
    // Links: [text](url)
    result = result.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

    return <span dangerouslySetInnerHTML={{ __html: result }} />
  }

  return <div className="markdown-renderer">{renderContent()}</div>
}