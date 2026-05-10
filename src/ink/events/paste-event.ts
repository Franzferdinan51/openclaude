
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const PasteEvent: any = undefined;
export type PasteEvent = any;
