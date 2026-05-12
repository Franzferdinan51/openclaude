/**
 * Clarification Middleware
 * Detects ambiguous requests and asks the user for clarification before proceeding.
 * Inspired by DeerFlow's ClarificationMiddleware.
 */

export interface ClarificationTrigger {
  /** Match pattern types */
  type: "vague_verbs" | "missing_context" | "multi_approach" | "ambiguous_pronoun";
  examples: string[];
  description: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[];
  placeholder?: string;
  context: string; // The original ambiguous request
  triggers: string[]; // Which trigger types matched
}

export interface ClarificationResult {
  answered: boolean;
  answer?: string;
  selectedOption?: number;
  resolvedIntent?: string;
}

// Trigger patterns that indicate ambiguous requests
const TRIGGERS: ClarificationTrigger[] = [
  {
    type: "vague_verbs",
    examples: ["fix", "improve", "update", "check", "review", "clean", "optimize"],
    description: "Generic verbs that could mean many different things",
  },
  {
    type: "missing_context",
    examples: ["it", "this", "that", "them", "those", "these"],
    description: "Pronouns without clear referent in the conversation",
  },
  {
    type: "multi_approach",
    examples: ["or", "either", "maybe", "might", "probably", "some way"],
    description: "Indicates multiple possible approaches were mentioned",
  },
  {
    type: "ambiguous_pronoun",
    examples: ["which one", "where", "what file", "which version", "who should"],
    description: "Questions that need more specificity",
  },
];

// Threshold for triggering clarification
const VAGUE_WORD_THRESHOLD = 0.3; // 30% vague words
const MIN_CONTEXT_LENGTH = 20; // Minimum message length to consider

export interface ClarificationConfig {
  /** Threshold for vague word ratio. Default: 0.3 */
  vagueThreshold: number;
  /** Minimum message length to consider. Default: 20 */
  minLength: number;
  /** Callback to generate the actual question */
  onAskClarification?: (q: ClarificationQuestion) => Promise<ClarificationResult>;
  /** Whether to always ask for first message (no history). Default: false */
  alwaysAskOnFirstMessage: boolean;
}

const DEFAULT_CONFIG: ClarificationConfig = {
  vagueThreshold: VAGUE_WORD_THRESHOLD,
  minLength: MIN_CONTEXT_LENGTH,
  alwaysAskOnFirstMessage: false,
};

/**
 * Analyzes a message for ambiguous patterns.
 */
export class ClarificationMiddleware {
  private config: ClarificationConfig;

  constructor(config: Partial<ClarificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze a user message and determine if clarification is needed.
   * Returns a ClarificationQuestion if clarification is needed, null otherwise.
   */
  analyze(userMessage: string, conversationHistory: MessageContext[] = []): ClarificationQuestion | null {
    const text = userMessage.trim();
    
    if (text.length < this.config.minLength) {
      return null;
    }

    const triggers = this.detectTriggers(text);
    
    if (triggers.length === 0) {
      return null;
    }

    // Build context summary from history
    const contextSummary = this.buildContextSummary(conversationHistory);
    
    const question = this.buildQuestion(text, triggers, contextSummary);
    return question;
  }

  private detectTriggers(text: string): string[] {
    const triggers: string[] = [];
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // Check for vague verbs
    const vagueVerbs = TRIGGERS.find((t) => t.type === "vague_verbs")!;
    const vagueCount = words.filter((w) => vagueVerbs.examples.includes(w)).length;
    if (vagueCount > 0 && vagueCount / words.length >= this.config.vagueThreshold) {
      triggers.push("vague_verbs");
    }

    // Check for pronouns without context
    const pronounTriggers = TRIGGERS.find((t) => t.type === "missing_context")!;
    const hasPronouns = pronounTriggers.examples.some((p) => lower.includes(p));
    const hasContext = conversationHasClearReferences(text);
    if (hasPronouns && !hasContext) {
      triggers.push("missing_context");
    }

    // Check for multi-approach indicators
    const approachTriggers = TRIGGERS.find((t) => t.type === "multi_approach")!;
    if (approachTriggers.examples.some((a) => lower.includes(a))) {
      triggers.push("multi_approach");
    }

    // Check for ambiguous questions
    const ambiguousTriggers = TRIGGERS.find((t) => t.type === "ambiguous_pronoun")!;
    if (ambiguousTriggers.examples.some((a) => lower.includes(a))) {
      triggers.push("ambiguous_pronoun");
    }

    return triggers;
  }

  private buildQuestion(text: string, triggers: string[], contextSummary: string): ClarificationQuestion {
    let question: string;
    let options: string[] | undefined;
    let placeholder: string | undefined;

    const triggerDescriptions = triggers.map((t) => {
      const trigger = TRIGGERS.find((tr) => tr.type === t);
      return trigger?.description ?? t;
    });

    if (triggers.includes("missing_context")) {
      question = `I noticed you used a reference like "it" or "that" — which specific item or task did you mean?`;
      placeholder = "e.g., 'the config file' or 'the login function'";
      options = contextSummary ? [contextSummary, "Something else"] : undefined;
    } else if (triggers.includes("vague_verbs")) {
      question = `Your request includes some vague terms. What specifically would you like me to do?`;
      placeholder = "Describe the specific action or goal";
      options = [
        "Make it work correctly",
        "Make it faster",
        "Make it more readable",
        "Add tests",
      ];
    } else if (triggers.includes("multi_approach")) {
      question = `I see there might be multiple ways to approach this. Which direction would you prefer?`;
      options = [
        "Quick and simple solution",
        "Thorough and robust solution",
        "Use a specific tool or technology",
        "Let me decide what's best",
      ];
    } else {
      question = `I want to make sure I understand correctly. Could you clarify what you mean by: "${truncate(text, 50)}"?`;
    }

    return {
      id: `clarify-${Date.now()}`,
      question,
      options,
      placeholder,
      context: text,
      triggers: triggerDescriptions,
    };
  }

  private buildContextSummary(history: MessageContext[]): string {
    if (history.length === 0) return "";
    
    // Get recent file references, function names, etc.
    const recentMessages = history.slice(-3);
    const references: string[] = [];
    
    for (const msg of recentMessages) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      // Extract quoted strings and file paths
      const quotes = content.match(/"([^"]+)"|'([^']+)'/g) ?? [];
      const paths = content.match(/[\w\/]+\.[\w]+/g) ?? [];
      references.push(...quotes.map((q) => q.replace(/"/g, "")).filter(Boolean));
      references.push(...paths.slice(0, 3));
    }

    // Deduplicate and limit
    const unique = [...new Set(references)].slice(0, 5);
    return unique.length > 0 ? unique.join(", ") : "";
  }

  /**
   * Check if the text has clear references (files, functions, etc.).
   * If it does, the pronoun warning is less likely to trigger.
   */
  hasClearReferences(text: string): boolean {
    return conversationHasClearReferences(text);
  }

  /**
   * Update config.
   */
  updateConfig(config: Partial<ClarificationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

function conversationHasClearReferences(text: string): boolean {
  // Check for file paths, function names, URLs, specific identifiers
  const patterns = [
    /\.\w{1,10}/, // file extensions: .ts, .js, .py
    /\/[\w\-./]+/, // paths
    /function\s+\w+/, // function declarations
    /const\s+\w+\s*=/, // variable declarations  
    /class\s+\w+/, // class declarations
    /https?:\/\//, // URLs
    /#\w+/, // headings or IDs
  ];
  return patterns.some((p) => p.test(text));
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export interface MessageContext {
  role: "user" | "assistant";
  content: string | unknown;
}

/**
 * Create a clarification middleware with default config.
 */
export function createClarificationMiddleware(
  config?: Partial<ClarificationConfig>,
): ClarificationMiddleware {
  return new ClarificationMiddleware(config);
}

/**
 * Quick check: does this message need clarification?
 */
export function needsClarification(message: string, history?: MessageContext[]): boolean {
  const mw = new ClarificationMiddleware();
  return mw.analyze(message, history) !== null;
}

export default ClarificationMiddleware;
