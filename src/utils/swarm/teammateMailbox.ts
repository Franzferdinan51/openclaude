
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const getLastPeerDmSummary: any = undefined;
export const readMailbox: any = undefined;
export const writeToMailbox: any = undefined;
