import type { StdoutMessage } from '../../entrypoints/sdk/controlTypes.js'
import type { StreamClientEvent } from './SSETransport.js'

export type TransportDataHandler = (data: string) => void
export type TransportCloseHandler = (closeCode?: number) => void
export type TransportConnectHandler = () => void
export type TransportEventHandler = (event: StreamClientEvent) => void

export interface Transport {
  connect(): Promise<void>
  write(message: StdoutMessage): Promise<void>
  close(): void
  setOnData(callback: TransportDataHandler): void
  setOnClose(callback: TransportCloseHandler): void
  setOnConnect?(callback: TransportConnectHandler): void
  setOnEvent?(callback: TransportEventHandler): void
}
