import type { ModelDescriptor } from '../../integrations/descriptors.js'
import {
  getAllModels,
  getModelsForBrand,
  getModelsForGateway,
  getModelsForVendor,
  getRouteDefaultModel,
  getRouteDescriptor,
  resolveActiveRouteIdFromEnv,
} from '../../integrations/index.js'
import { getModelCapability } from './modelCapabilities.js'

function normalizeModelKey(model: string): string {
  return model.trim().toLowerCase().replace(/\s*\[1m\]\s*$/i, '')
}

function findModelDescriptor(
  model: string,
  routeId: string | null,
): ModelDescriptor | undefined {
  const normalizedModel = normalizeModelKey(model)

  return getAllModels().find(candidate => {
    if (
      normalizeModelKey(candidate.id) === normalizedModel ||
      normalizeModelKey(candidate.defaultModel) === normalizedModel
    ) {
      return true
    }

    if (!routeId) {
      return false
    }

    const routeMappedModel = candidate.providerModelMap?.[routeId]
    return routeMappedModel
      ? normalizeModelKey(routeMappedModel) === normalizedModel
      : false
  })
}

function collectCandidateModelNames(
  target: string[],
  seen: Set<string>,
  models: readonly ModelDescriptor[],
): void {
  for (const model of models) {
    const candidates = [model.defaultModel, model.id]
    for (const candidate of candidates) {
      const normalized = normalizeModelKey(candidate)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        target.push(candidate)
      }
    }
  }
}

export function resolveVisionModelOverride(
  currentModel: string,
  processEnv: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const currentCapability = getModelCapability(currentModel)
  if (currentCapability?.supportsVision) {
    return undefined
  }

  const routeId = resolveActiveRouteIdFromEnv(processEnv)
  const routeDescriptor = routeId ? getRouteDescriptor(routeId) : null
  const currentDescriptor = findModelDescriptor(currentModel, routeId)
  const routeMatchesCurrentDescriptor =
    !routeId ||
    !routeDescriptor ||
    !currentDescriptor
      ? Boolean(routeId && routeDescriptor)
      : currentDescriptor.gatewayId === routeId ||
        currentDescriptor.vendorId === routeId ||
        ('vendorId' in routeDescriptor &&
          routeDescriptor.vendorId === currentDescriptor.vendorId)
  const currentModelKey = normalizeModelKey(currentModel)
  const candidateNames: string[] = []
  const seenCandidates = new Set<string>([currentModelKey])

  const addCandidate = (candidate?: string): void => {
    if (!candidate) {
      return
    }

    const normalized = normalizeModelKey(candidate)
    if (seenCandidates.has(normalized)) {
      return
    }

    seenCandidates.add(normalized)
    candidateNames.push(candidate)
  }

  if (currentDescriptor?.gatewayId) {
    collectCandidateModelNames(
      candidateNames,
      seenCandidates,
      getModelsForGateway(currentDescriptor.gatewayId),
    )
  }

  if (currentDescriptor?.brandId) {
    collectCandidateModelNames(
      candidateNames,
      seenCandidates,
      getModelsForBrand(currentDescriptor.brandId),
    )
  }

  if (currentDescriptor?.vendorId) {
    collectCandidateModelNames(
      candidateNames,
      seenCandidates,
      getModelsForVendor(currentDescriptor.vendorId),
    )
  }

  if (routeMatchesCurrentDescriptor && routeId && routeDescriptor) {
    addCandidate(getRouteDefaultModel(routeId))

    if ('vendorId' in routeDescriptor) {
      collectCandidateModelNames(
        candidateNames,
        seenCandidates,
        getModelsForGateway(routeId),
      )
      if (routeDescriptor.vendorId) {
        collectCandidateModelNames(
          candidateNames,
          seenCandidates,
          getModelsForVendor(routeDescriptor.vendorId),
        )
      }
    } else {
      collectCandidateModelNames(
        candidateNames,
        seenCandidates,
        getModelsForVendor(routeId),
      )
    }
  }

  return candidateNames.find(candidate =>
    getModelCapability(candidate)?.supportsVision,
  )
}
