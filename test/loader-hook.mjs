export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@deepseek-ai/dsh-typert-protocol') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
        export class TypertRemoteService {
          constructor(ctx, name) {
            this.ctx = ctx;
            this.name = name;
          }
        }
        export class RemoteError extends Error {
          constructor(code, message, details) {
            super(message);
            this.code = code;
            this.details = details;
          }
        }
        export function Remote() {
          return (val, ctx) => {
            if (ctx?.addInitializer) ctx.addInitializer(() => {});
          };
        }
      `),
    };
  }
  return nextResolve(specifier, context);
}
