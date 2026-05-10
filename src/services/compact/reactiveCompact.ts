
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const isReactiveOnlyMode: any = undefined;
export const reactiveCompactOnPromptTooLong: any = undefined;
export const isReactiveCompactEnabled: any = undefined;
export const isWithheldPromptTooLong: any = undefined;
export const isWithheldMediaSizeError: any = undefined;
export const tryReactiveCompact: any = undefined;
