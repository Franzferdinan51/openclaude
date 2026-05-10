
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const TERMINAL_CAPTURE_TOOL_NAME: any = undefined;
