import { getAllModels } from '../../integrations/index.js'

export type ModelCapability = {
  id: string
  max_input_tokens?: number
  max_tokens?: number
  supportsVision?: boolean
}

let capabilityCache = new Map<string, ModelCapability>()

function normalizeCapabilityKey(model: string): string {
  return model.trim().toLowerCase().replace(/\s*\[1m\]\s*$/i, '')
}

function buildCapabilityCache(): Map<string, ModelCapability> {
  const next = new Map<string, ModelCapability>()

  for (const model of getAllModels()) {
    const capability: ModelCapability = {
      id: model.id,
      max_input_tokens: model.contextWindow,
      max_tokens: model.maxOutputTokens,
      supportsVision: model.capabilities.supportsVision,
    }

    next.set(normalizeCapabilityKey(model.id), capability)
    next.set(normalizeCapabilityKey(model.defaultModel), capability)
  }

  return next
}

export function getModelCapability(
  model: string,
): ModelCapability | undefined {
  if (capabilityCache.size === 0) {
    capabilityCache = buildCapabilityCache()
  }

  return capabilityCache.get(normalizeCapabilityKey(model))
}

export async function refreshModelCapabilities(): Promise<void> {
  capabilityCache = buildCapabilityCache()
}
