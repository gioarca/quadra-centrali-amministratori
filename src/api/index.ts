/**
 * L'"API" della demo: tutto in memoria nel browser (demo.ts). Le schermate parlano solo con `api`:
 * per collegare un server vero basta un secondo oggetto con la stessa interfaccia (types.ts).
 */
export { demoApi as api } from "./demo.ts";
export * from "./types.ts";
