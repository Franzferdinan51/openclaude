
const _stub: any = new Proxy(() => ({}), { 
  get: (target, prop) => {
    if (prop === 'then') return undefined;
    if (prop === 'Symbol(Symbol.toStringTag)') return 'Stub';
    return _stub;
  },
  apply: () => ({})
});
export default _stub;
export const __stub = true;
export const isProactiveActive: any = _stub;
export const activateProactive: any = _stub;
export const isProactivePaused: any = _stub;
export const deactivateProactive: any = _stub;
