// Stub exports for type bypass - Ultraplan disabled via feature flag
import type { ComponentType } from 'react';

interface UltraplanChoiceDialogProps {
  plan: unknown;
  sessionId: string;
  taskId: string;
  setMessages: any;
  readFileState: unknown;
  getAppState: () => unknown;
  setConversationId: any;
}

interface UltraplanLaunchDialogProps {
  onChoice: (choice: unknown, opts?: unknown) => void;
}

export const UltraplanChoiceDialog: ComponentType<UltraplanChoiceDialogProps> = () => null;
export const UltraplanLaunchDialog: ComponentType<UltraplanLaunchDialogProps> = () => null;
