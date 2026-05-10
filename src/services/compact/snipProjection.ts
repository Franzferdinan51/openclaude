
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const isSnipBoundaryMessage: any = undefined;
export const projectSnippedView: any = undefined;
