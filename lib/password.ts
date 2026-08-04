export function isValidPassword(pass: string): boolean {
  return (
    pass.length >= 8 &&
    /[a-z]/.test(pass) &&
    /[A-Z]/.test(pass) &&
    /[0-9]/.test(pass) &&
    /[^a-zA-Z0-9]/.test(pass)
  );
}
