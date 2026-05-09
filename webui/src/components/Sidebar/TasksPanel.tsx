import React, { useState, useEffect } from 'react';
import { SidebarItem } from './SidebarItem';
import { listRuns } from '../../api/gateway';

interface TaskInfo {
  id: string;
  label: string;
  status: 'running' | 'pending' | 'done' | 'error';
  progress?: number;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  useEffect(() => {
    const fetchTasks = () => {
      listRuns()
        .then(runs => setTasks(runs.map(run => ({
          id: run.id,
          label: run.title,
          status: run.status === 'completed' ? 'done' : run.status === 'failed' ? 'error' : run.status === 'queued' ? 'pending' : 'running',
        }))))
        .catch(() => setTasks([]));
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const STATUS_ICONS: Record<TaskInfo['status'], string> = {
    running: 'RUN',
    pending: 'WAIT',
    done: 'OK',
    error: 'ERR',
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
