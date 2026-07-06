export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return resolve(new URL(`../src/${specifier.slice(2)}`, import.meta.url).href, context, nextResolve);
  }

  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:")) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || specifier.endsWith(".ts")) {
        throw error;
      }

      return nextResolve(`${specifier}.ts`, context);
    }
  }

  return nextResolve(specifier, context);
}
