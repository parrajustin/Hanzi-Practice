export function LogError(message: string) {
  const stackLines = new Error().stack!.split("\n").slice(2);
  console.group("Error!");
  console.error(`Error Message: ${message}`, stackLines);
  console.groupEnd();
}
