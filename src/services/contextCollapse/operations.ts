
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const projectView: any = undefined;
