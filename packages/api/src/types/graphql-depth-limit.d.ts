declare module 'graphql-depth-limit' {
  import type { ValidationRule } from 'graphql';
  function depthLimit(
    maxDepth: number,
    options?: { ignore?: (string | RegExp)[] },
    callback?: (depths: Record<string, number>) => void,
  ): ValidationRule;
  export default depthLimit;
}
