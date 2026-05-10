
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const DiscoverySignal: any = undefined;
export type DiscoverySignal = any;
