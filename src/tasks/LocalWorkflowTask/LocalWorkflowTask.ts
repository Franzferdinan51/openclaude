
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const LocalWorkflowTaskState: any = undefined;
export type LocalWorkflowTaskState = any;
export const killWorkflowTask: any = undefined;
export const skipWorkflowAgent: any = undefined;
export const retryWorkflowAgent: any = undefined;
