/**
 * Fact Extraction from Conversation Messages
 * Extracts structured facts from user/assistant message pairs.
 */

import type { Message } from "../../types/message.js";
import { extractTextContent } from "../../utils/messages.js";

export interface ExtractedFact {
  content: string;
  confidence: number;
  category: FactCategory;
  sourceMessageIndex?: number;
}

export type FactCategory =
  | "preference"
  | "fact"
  | "context"
  | "requirement"
  | "relationship";

/**
 * Extract facts from a message.
 * Returns multiple potential facts with confidence scores.
 */
export function extractFactsFromMessage(
  message: Message,
  index: number,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const content = extractTextContent(message.content);
  
  if (!content || content.length < 10) return facts;

  // Extract explicit statements
  const statements = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  for (const statement of statements) {
    const trimmed = statement.trim();
    
    // Heuristics for fact type and confidence
    
    // Explicit preferences (I prefer, I like, I want, I need)
    if (/i (prefer|like|want|need|always|usually|never)/i.test(trimmed)) {
      facts.push({
        content: trimmed,
        confidence: 0.85,
        category: "preference",
        sourceMessageIndex: index,
      });
      continue;
    }

    // Explicit facts (X is Y, X was Z, the file is at)
    if (/^(the|this|that|my|your|it|a |an )/i.test(trimmed) && 
        /^(is|was|are|were|has|have|contains|in|at|on)/.test(trimmed)) {
      facts.push({
        content: trimmed,
        confidence: 0.8,
        category: "fact",
        sourceMessageIndex: index,
      });
      continue;
    }

    // Requirements (must, need to, required, should)
    if (/\b(must|need to|required|should|has to|have to)/i.test(trimmed)) {
      facts.push({
        content: trimmed,
        confidence: 0.75,
        category: "requirement",
        sourceMessageIndex: index,
      });
      continue;
    }

    // Context hints (when, if, after, before)
    if (/\b(when|if|after|before|during|while)\b/i.test(trimmed) && trimmed.length < 100) {
      facts.push({
        content: trimmed,
        confidence: 0.6,
        category: "context",
        sourceMessageIndex: index,
      });
      continue;
    }
  }

  return facts;
}

/**
 * Extract facts from a conversation.
 * Returns deduplicated, sorted-by-confidence facts.
 */
export function extractFactsFromConversation(
  messages: Message[],
  options?: { minConfidence?: number; maxFacts?: number },
): ExtractedFact[] {
  const allFacts: ExtractedFact[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type !== "user" && msg.type !== "assistant") continue;
    const facts = extractFactsFromMessage(msg, i);
    allFacts.push(...facts);
  }

  // Deduplicate by content (case-insensitive)
  const seen = new Set<string>();
  const unique: ExtractedFact[] = [];
  
  for (const fact of allFacts) {
    const key = fact.content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fact);
  }

  // Filter by confidence
  const minConf = options?.minConfidence ?? 0;
  const filtered = unique.filter((f) => f.confidence >= minConf);

  // Sort by confidence desc, then by position in conversation
  filtered.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (a.sourceMessageIndex ?? 0) - (b.sourceMessageIndex ?? 0);
  });

  // Limit
  const max = options?.maxFacts ?? 50;
  return filtered.slice(0, max);
}

/**
 * Generate a memory update prompt for a subagent.
 * Used by SessionMemory to extract facts via forked agent.
 */
export function buildFactExtractionPrompt(
  messages: Message[],
  currentMemory: string,
): string {
  const recentMessages = messages.slice(-20);
  const conversationText = recentMessages
    .map((m, i) => `[${m.type}]: ${extractTextContent(m.content)}`)
    .join("\n");

  return `You are a memory extraction system. Analyze the recent conversation and extract key facts and preferences.

Current memory:
${currentMemory || "(empty)"}

Recent conversation:
${conversationText}

Extract facts that:
1. Are specific enough to be useful (not vague/general)
2. Represent stable information (not one-off comments)
3. Include user preferences, requirements, or important context

Respond with a JSON array of facts, each with:
- "content": the fact text (specific, concise)
- "confidence": 0.0-1.0 (higher = more confident this is stable info)
- "category": one of "preference", "fact", "context", "requirement"
- "tags": relevant tags like ["work", "project-x", "settings"]

Example:
[
  {"content": "User prefers dark mode", "confidence": 0.9, "category": "preference", "tags": ["settings"]},
  {"content": "API endpoint is at /api/v2", "confidence": 0.85, "category": "fact", "tags": ["project-x"]}
]

Only return facts with confidence >= 0.6. Return "[]" if nothing significant found.`;
}

export default {
  extractFactsFromMessage,
  extractFactsFromConversation,
  buildFactExtractionPrompt,
};
