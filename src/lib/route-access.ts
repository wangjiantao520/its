export function isPublicPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/share/');
}

export function isAllowedPath(pathname: string, allowedPaths: readonly string[]): boolean {
  return allowedPaths.some((allowedPath) =>
    pathname === allowedPath ||
    (allowedPath !== '/' && pathname.startsWith(`${allowedPath}/`)),
  );
}
