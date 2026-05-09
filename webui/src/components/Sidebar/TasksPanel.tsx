import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';

interface TaskInfo {
  id: string;
  label: string;
  status: 'running' | 'pending' | 'done' | 'error';
  progress?: number;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  useEffect(() => {
    // Poll for background tasks from gateway
    const fetchTasks = () => {
      fetch('http://localhost:18789/api/tasks')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setTasks(data);
        })
        .catch(() => setTasks([]));
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const STATUS_ICONS: Record<TaskInfo['status'], string> = {
    running: '⚡',
    pending: '⏳',
    done: '✅',
    error: '❌',
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
        Tasks
      </div>
      {tasks.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280' }}>
          No active tasks
        </div>
      )}
      {tasks.map(task => (
        <SidebarItem
          key={task.id}
          label={task.label}
          icon={<span style={{ fontSize: '12px' }}>{STATUS_ICONS[task.status]}</span>}
          onClick={() => {}}
        />
      ))}
    </div>
  );
}
