import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';

interface FileNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

export function FilesPanel() {
  const [files, setFiles] = useState<FileNode[]>([
    { name: 'src', type: 'dir', children: [
      { name: 'agent', type: 'dir' },
      { name: 'orchestrator', type: 'dir' },
      { name: 'tools', type: 'dir' },
    ]},
    { name: 'config', type: 'dir' },
    { name: 'package.json', type: 'file' },
  ]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['src', 'config']));

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    const path = node.name;
    const isExpanded = expanded.has(path);
    const indent = depth * 12;

    return (
      <div key={path}>
        <div
          onClick={() => node.type === 'dir' && toggle(path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            paddingLeft: `${12 + indent}px`,
            cursor: node.type === 'dir' ? 'pointer' : 'default',
            fontSize: '12px',
            color: '#c0c0d0',
            borderRadius: '4px',
          }}
          onMouseEnter={e => {
            (e.target as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: '11px', opacity: 0.6 }}>
            {node.type === 'dir' ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span>{node.name}</span>
        </div>
        {node.type === 'dir' && isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: '#6b7280',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: '8px 12px 4px',
      }}>
        Files
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {files.map(node => renderNode(node))}
      </div>
    </div>
  );
}
