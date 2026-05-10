
const _stub: any = new Proxy({}, { get: () => () => ({} as any) });
export default _stub;
export const __stub = true;
export const logHandler: any = undefined;
export const errorHandler: any = undefined;
export const exportHandler: any = undefined;
export const taskCreateHandler: any = undefined;
export const taskListHandler: any = undefined;
export const taskGetHandler: any = undefined;
export const taskUpdateHandler: any = undefined;
export const taskDirHandler: any = undefined;
export const completionHandler: any = undefined;
