
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
export const NotebookCellType: any = _stub;
export const NotebookContent: any = _stub;
export const NotebookCell: any = _stub;
export const NotebookCellOutput: any = _stub;
export const NotebookCellSource: any = _stub;
export const NotebookCellSourceOutput: any = _stub;
export const NotebookOutputImage: any = _stub;
