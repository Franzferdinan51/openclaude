import React, { useRef } from 'react';
import stripAnsi from 'strip-ansi';
import { Messages } from '../components/Messages.js';
import { KeybindingProvider } from '../keybindings/KeybindingContext.js';
import { loadKeybindingsSyncWithWarnings } from '../keybindings/loadUserBindings.js';
import type { KeybindingContextName } from '../keybindings/types.js';
import { AppStateProvider } from '../state/AppState.js';
import type { Tools } from '../Tool.js';
import type { Message } from '../types/message.js';
import type { ExportFormat } from './exportFormats.js';
import { renderToAnsiString } from './staticRender.js';

/**
 * Minimal keybinding provider for static/headless renders.
 * Provides keybinding context without the ChordInterceptor (which uses useInput
 * and would hang in headless renders with no stdin).
 */
function StaticKeybindingProvider({
  children
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const {
    bindings
  } = loadKeybindingsSyncWithWarnings();
  const pendingChordRef = useRef(null);
  const handlerRegistryRef = useRef(new Map());
  const activeContexts = useRef(new Set<KeybindingContextName>()).current;
  return <KeybindingProvider bindings={bindings} pendingChordRef={pendingChordRef} pendingChord={null} setPendingChord={() => {}} activeContexts={activeContexts} registerActiveContext={() => {}} unregisterActiveContext={() => {}} handlerRegistryRef={handlerRegistryRef}>
      {children}
    </KeybindingProvider>;
}

// Upper-bound how many NormalizedMessages a Message can produce.
// normalizeMessages splits one Message with N content blocks into N
// NormalizedMessages — 1:1 with block count. String content = 1 block.
// AttachmentMessage etc. have no .message and normalize to ≤1.
function normalizedUpperBound(m: Message): number {
  if (!('message' in m)) return 1;
  const c = m.message.content;
  return Array.isArray(c) ? c.length : 1;
}

/**
 * Streams rendered messages in chunks, ANSI codes preserved. Each chunk is a
 * fresh renderToAnsiString — yoga layout tree + Ink's screen buffer are sized
 * to the tallest CHUNK instead of the full session. Measured (Mar 2026,
 * 538-msg session): −55% plateau RSS vs a single full render. The sink owns
 * the output — write to stdout for `[` dump-to-scrollback, appendFile for `v`.
 *
 * Messages.renderRange slices AFTER normalize→group→collapse, so tool-call
 * grouping stays correct across chunk seams; buildMessageLookups runs on
 * the full normalized array so tool_use↔tool_result resolves regardless of
 * which chunk each landed in.
 */
export async function streamRenderedMessages(messages: Message[], tools: Tools, sink: (ansiChunk: string) => void | Promise<void>, {
  columns,
  verbose = false,
  chunkSize = 40,
  onProgress
}: {
  columns?: number;
  verbose?: boolean;
  chunkSize?: number;
  onProgress?: (rendered: number) => void;
} = {}): Promise<void> {
  const renderChunk = (range: readonly [number, number]) => renderToAnsiString(<AppStateProvider>
        <StaticKeybindingProvider>
          <Messages messages={messages} tools={tools} commands={[]} verbose={verbose} toolJSX={null} toolUseConfirmQueue={[]} inProgressToolUseIDs={new Set()} isMessageSelectorVisible={false} conversationId="export" screen="prompt" streamingToolUses={[]} showAllInTranscript={true} isLoading={false} renderRange={range} />
        </StaticKeybindingProvider>
      </AppStateProvider>, columns);

  // renderRange indexes into the post-collapse array whose length we can't
  // see from here — normalize splits each Message into one NormalizedMessage
  // per content block (unbounded per message), collapse merges some back.
  // Ceiling is the exact normalize output count + chunkSize so the loop
  // always reaches the empty slice where break fires (collapse only shrinks).
  let ceiling = chunkSize;
  for (const m of messages) ceiling += normalizedUpperBound(m);
  for (let offset = 0; offset < ceiling; offset += chunkSize) {
    const ansi = await renderChunk([offset, offset + chunkSize]);
    if (stripAnsi(ansi).trim() === '') break;
    await sink(ansi);
    onProgress?.(offset + chunkSize);
  }
}

/**
 * Renders messages to a plain text string suitable for export.
 * Uses the same React rendering logic as the interactive UI.
 */
export async function renderMessagesToPlainText(messages: Message[], tools: Tools = [], columns?: number): Promise<string> {
  const parts: string[] = [];
  await streamRenderedMessages(messages, tools, chunk => void parts.push(stripAnsi(chunk)), {
    columns
  });
  return parts.join('');
}

function titleCaseRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content.map(item => {
    if (!item || typeof item !== 'object') return '';
    const block = item as Record<string, unknown>;
    if (typeof block.text === 'string') return block.text;
    if (typeof block.content === 'string') return block.content;
    if (block.type === 'tool_use') {
      return `[tool_use: ${String(block.name ?? block.id ?? 'unknown')}]`;
    }
    if (block.type === 'tool_result') {
      return `[tool_result: ${String(block.tool_use_id ?? block.id ?? 'unknown')}] ${extractTextContent(block.content)}`.trim();
    }
    return '';
  }).filter(Boolean).join('\n');
}

function messageRole(message: Message): string {
  if (typeof message?.type === 'string') return message.type;
  if (typeof message?.message?.role === 'string') return message.message.role;
  return 'message';
}

function messageContent(message: Message): string {
  if ('message' in message && message.message) {
    return extractTextContent(message.message.content);
  }
  return extractTextContent(message.content);
}

export function renderMessagesToMarkdown(messages: Message[]): string {
  const sections: string[] = ['# DuckHive Conversation Export'];

  for (const message of messages) {
    const role = messageRole(message);
    if (role === 'progress' || role === 'attachment') continue;
    const content = messageContent(message).trim();
    if (!content) continue;
    sections.push(`## ${titleCaseRole(role)}\n\n${content}`);
  }

  return `${sections.join('\n\n')}\n`;
}

export function renderMessagesToJson(messages: Message[]): string {
  const exported = {
    exportedAt: new Date().toISOString(),
    schema: 'duckhive.conversation-export.v1',
    messages
  };
  return `${JSON.stringify(exported, null, 2)}\n`;
}

export async function renderMessagesForExport(
  messages: Message[],
  tools: Tools = [],
  {
    format = 'text',
    columns
  }: {
    format?: ExportFormat
    columns?: number
  } = {},
): Promise<string> {
  switch (format) {
    case 'markdown':
      return renderMessagesToMarkdown(messages);
    case 'json':
      return renderMessagesToJson(messages);
    case 'text':
      return renderMessagesToPlainText(messages, tools, columns);
  }
}
