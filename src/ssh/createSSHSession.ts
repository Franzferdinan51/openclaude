
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
export const SSHSession: any = _stub;
export const createSSHSession: any = _stub;
export const createLocalSSHSession: any = _stub;
export const SSHSessionError: any = _stub;
