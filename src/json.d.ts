// Type the bundled #20 schema loosely as `object` — importing it as a value
// (esbuild inlines it at build) without forcing tsc to infer the 185 KB JSON
// as a giant literal type.
declare module '*.json' {
  const value: object;
  export default value;
}
