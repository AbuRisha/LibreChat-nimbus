// Singleton Pyodide loader — one instance shared across all code blocks
let pyodideInstance: any = null;
let loadingPromise: Promise<any> | null = null;

export async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js';
    document.head.appendChild(script);
    await new Promise((r) => {
      script.onload = r;
    });
    // @ts-ignore
    pyodideInstance = await (window as any).loadPyodide();
    return pyodideInstance;
  })();
  return loadingPromise;
}
