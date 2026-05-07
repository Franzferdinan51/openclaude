// Stub for upstream integrations module
// DuckHive uses its own MCP-based integration system instead

export interface AnthropicProxyDescriptor {
  id: string
  name: string
}

export interface GatewayDescriptor {
  id: string
  name: string
}

export function ensureIntegrationsLoaded(): void {
  // No-op for DuckHive
}

export function registerGateway(_gateway: GatewayDescriptor): void {
  // No-op for DuckHive
}

export function getAllGateways(): GatewayDescriptor[] {
  return []
}

export function getGateway(_id: string): GatewayDescriptor | undefined {
  return undefined
}

export function getAllVendors(): unknown[] {
  return []
}

export function getVendor(_id: string): unknown | undefined {
  return undefined
}

export function registerVendor(_vendor: unknown): void {
  // No-op
}

export function getAllBrands(): unknown[] {
  return []
}

export function getBrand(_id: string): unknown | undefined {
  return undefined
}

export function getBrandsForVendor(_vendorId: string): unknown[] {
  return []
}

export function registerBrand(_brand: unknown): void {
  // No-op
}

export function getAllModels(): unknown[] {
  return []
}

export function getModel(_id: string): unknown | undefined {
  return undefined
}

export function getModelsForBrand(_brandId: string): unknown[] {
  return []
}

export function registerModel(_model: unknown): void {
  // No-op
}

export function getCatalogEntriesForRoute(_route: string): unknown[] {
  return []
}

export function getCatalogForGateway(_gatewayId: string): unknown[] {
  return []
}

export function getCatalogForVendor(_vendorId: string): unknown[] {
  return []
}

export function getModelsForGateway(_gatewayId: string): unknown[] {
  return []
}

export function getModelsForVendor(_vendorId: string): unknown[] {
  return []
}

export function getAnthropicProxy(_id: string): AnthropicProxyDescriptor | undefined {
  return undefined
}

export function getAllAnthropicProxies(): AnthropicProxyDescriptor[] {
  return []
}

export function registerAnthropicProxy(_proxy: AnthropicProxyDescriptor): void {
  // No-op
}

export function validateIntegrationRegistry(): void {
  // No-op
}

export function _clearRegistryForTesting(): void {
  // No-op
}
