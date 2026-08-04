// JSX fallback for loose custom elements only. Real React types come from @types/react.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
