
const _stub: any = new Proxy(() => ({}), { 
  get: (target, prop) => {
    if (prop === 'then') return undefined;
    if (typeof prop === 'symbol' || prop === 'toString' || prop === 'valueOf') return target[prop];
    return _stub;
  },
  apply: () => ({})
});
export default _stub;
export const __stub = true;
export const psHandler: any = _stub;
export const logsHandler: any = _stub;
export const attachHandler: any = _stub;
export const killHandler: any = _stub;
export const handleBgFlag: any = _stub;
