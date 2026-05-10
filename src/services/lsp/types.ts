
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const ScopedLspServerConfig: any = undefined;
export const LspServerState: any = undefined;
export const LspServerConfig: any = undefined;
export type ScopedLspServerConfig = any;
export type LspServerState = any;
export type LspServerConfig = any;
