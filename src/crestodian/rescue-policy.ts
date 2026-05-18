/**
 * DuckCustodian Rescue Policy — guardrails for remote/privileged operations.
 * Mirrors OpenClaw's Crestodian rescue-policy pattern.
 *
 * Rescue mode is for when DuckHive needs to perform privileged operations
 * (config changes, restarts, etc.) either locally or via a remote channel.
 */

export type DuckCustodianRescueDecision = {
  allowed: boolean;
  enabled: boolean;
  ownerOnly: boolean;
  pendingTtlMinutes: number;
  yolo: boolean;
  sandboxActive: boolean;
  reason?: 'disabled' | 'sandbox-active' | 'not-yolo' | 'not-owner' | 'not-direct-message';
  message?: string;
};

export type DuckCustodianRescuePolicyInput = {
  /** Whether the requester is the owner/admin */
  senderIsOwner: boolean;
  /** Whether this is a direct message (vs group/channel) */
  isDirectMessage: boolean;
  /** Whether YOLO mode is active (no sandbox, full exec) */
  yoloActive: boolean;
  /** Whether sandbox is currently active */
  sandboxActive: boolean;
  /** Rescue enabled setting: true, false, or 'auto' */
  rescueEnabled?: boolean;
  /** Owner DMs only setting */
  ownerDmOnly?: boolean;
  /** Pending operation TTL in minutes */
  pendingTtlMinutes?: number;
};

function resolvePendingTtlMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 15;
}

export function resolveDuckCustodianRescuePolicy(
  input: DuckCustodianRescuePolicyInput,
): DuckCustodianRescueDecision {
  const rescueEnabled = input.rescueEnabled ?? 'auto';
  const ownerDmOnly = input.ownerDmOnly ?? true;
  const pendingTtlMinutes = resolvePendingTtlMinutes(input.pendingTtlMinutes);
  const enabled = rescueEnabled === 'auto' ? input.yoloActive : rescueEnabled;

  if (enabled === false) {
    return {
      allowed: false,
      enabled: false,
      ownerOnly: ownerDmOnly,
      pendingTtlMinutes,
      yolo: input.yoloActive,
      sandboxActive: input.sandboxActive,
      reason: 'disabled',
      message: 'DuckCustodian rescue is disabled.',
    };
  }

  if (input.sandboxActive) {
    return {
      allowed: false,
      enabled: true,
      ownerOnly: ownerDmOnly,
      pendingTtlMinutes,
      yolo: input.yoloActive,
      sandboxActive: true,
      reason: 'sandbox-active',
      message: 'DuckCustodian rescue is blocked while sandboxing is active.',
    };
  }

  if (rescueEnabled === 'auto' && !input.yoloActive) {
    return {
      allowed: false,
      enabled: true,
      ownerOnly: ownerDmOnly,
      pendingTtlMinutes,
      yolo: false,
      sandboxActive: false,
      reason: 'not-yolo',
      message: 'DuckCustodian rescue auto-mode only activates in YOLO posture (sandbox off, exec security full, ask off).',
    };
  }

  if (!input.senderIsOwner) {
    return {
      allowed: false,
      enabled: true,
      ownerOnly: ownerDmOnly,
      pendingTtlMinutes,
      yolo: input.yoloActive,
      sandboxActive: false,
      reason: 'not-owner',
      message: 'DuckCustodian rescue only accepts commands from the owner.',
    };
  }

  if (ownerDmOnly && !input.isDirectMessage) {
    return {
      allowed: false,
      enabled: true,
      ownerOnly: true,
      pendingTtlMinutes,
      yolo: input.yoloActive,
      sandboxActive: false,
      reason: 'not-direct-message',
      message: 'DuckCustodian rescue is restricted to direct messages.',
    };
  }

  return {
    allowed: true,
    enabled: true,
    ownerOnly: ownerDmOnly,
    pendingTtlMinutes,
    yolo: input.yoloActive,
    sandboxActive: false,
  };
}