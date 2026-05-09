declare module '@anthropic-ai/claude-agent-sdk' {
  export type PermissionMode =
    | 'default'
    | 'plan'
    | 'acceptEdits'
    | 'bypassPermissions'
    | string
}

declare module 'nodemailer' {
  export function createTransport(...args: any[]): {
    sendMail(...args: any[]): Promise<any>
    close?(): void
  }
}

declare module 'imap' {
  export default class Imap {
    constructor(config: any)
    connect(): void
    end(): void
    once(event: string, listener: (...args: any[]) => void): this
    on(event: string, listener: (...args: any[]) => void): this
    openBox(...args: any[]): void
    search(...args: any[]): void
    fetch(...args: any[]): {
      on(event: string, listener: (...args: any[]) => void): any
    }
  }
}

declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient {
    constructor(config?: any)
    send(command: any): Promise<{
      inferenceProfileSummaries?: Array<{ inferenceProfileId?: string }>
      nextToken?: string
    }>
  }
  export class ListInferenceProfilesCommand {
    constructor(input?: any)
  }
}

declare module '@aws-sdk/client-sts' {
  export class STSClient {
    constructor(config?: any)
    send(command: any): Promise<any>
  }
  export class GetCallerIdentityCommand {
    constructor(input?: any)
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-grpc' {
  export class OTLPMetricExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-http' {
  export class OTLPMetricExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-proto' {
  export class OTLPMetricExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-prometheus' {
  export class PrometheusExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-logs-otlp-grpc' {
  export class OTLPLogExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-logs-otlp-http' {
  export class OTLPLogExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-logs-otlp-proto' {
  export class OTLPLogExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-trace-otlp-grpc' {
  export class OTLPTraceExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter {
    constructor(config?: any)
  }
}

declare module '@opentelemetry/exporter-trace-otlp-proto' {
  export class OTLPTraceExporter {
    constructor(config?: any)
  }
}

declare module '@anthropic-ai/mcpb' {
  export type McpbUserConfigurationOption = any
  export type McpbManifest = any
  export const McpbManifestSchema: {
    safeParse(value: any): { success: true; data: McpbManifest } | { success: false; error: any }
  }
  export function getMcpConfigForManifest(...args: any[]): any
}

declare module '@ant/claude-for-chrome-mcp' {
  export const BROWSER_TOOLS: any[]
  export function createChromeMcpServer(...args: any[]): any
}

declare module '@ant/computer-use-mcp/types' {
  export type CoordinateMode = 'api' | 'screen' | string
  export type CuSubGates = Record<string, boolean>
  export type CuPermissionRequest = any
  export type CuPermissionResponse = any
  export const DEFAULT_GRANT_FLAGS: Record<string, boolean>
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  export function getSentinelCategory(...args: any[]): string | undefined
}

declare module '@ant/computer-use-mcp' {
  export type ComputerUseSessionContext = any
  export type CuCallToolResult = any
  export type CuPermissionRequest = any
  export type CuPermissionResponse = any
  export type ScreenshotDims = any
  export type ComputerExecutor = any
  export type DisplayGeometry = any
  export type FrontmostApp = any
  export type InstalledApp = any
  export type ResolvePrepareCaptureResult = any
  export type RunningApp = any
  export type ScreenshotResult = any
  export const DEFAULT_GRANT_FLAGS: Record<string, boolean>
  export const API_RESIZE_PARAMS: any
  export function targetImageSize(...args: any[]): [number, number]
  export function bindSessionContext(...args: any[]): (name: string, args: any) => Promise<CuCallToolResult>
  export function buildComputerUseTools(...args: any[]): any[]
  export function createComputerUseMcpServer(...args: any[]): {
    setRequestHandler(...args: any[]): void
  }
}

declare module '@ant/computer-use-input' {
  export type ComputerUseInput = any
  const mod: ComputerUseInput
  export default mod
}

declare module '@ant/computer-use-swift' {
  export type ComputerUseAPI = any
  const mod: ComputerUseAPI
  export default mod
}

declare module 'asciichart' {
  export function plot(...args: any[]): string
}

declare module 'audio-capture-napi' {
  const mod: any
  export = mod
}

declare module 'cacache' {
  const mod: {
    rm?: { all?(path: string): Promise<void> }
  }
  export = mod
}

declare module 'image-processor-napi' {
  export function getNativeModule(): any
  const mod: any
  export default mod
}

declare module 'plist' {
  export function parse(value: string): any
  export function build(value: any): string
}

declare module 'url-handler-napi' {
  export function waitForUrlEvent(...args: any[]): Promise<string>
}
