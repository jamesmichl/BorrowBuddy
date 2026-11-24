export function loginPath(destination: string) {
  return "/masuk?next=" + encodeURIComponent(destination);
}
