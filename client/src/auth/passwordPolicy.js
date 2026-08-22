// Mirrors the server-side policy in Mini-SSO's AuthService (EnsurePasswordPolicy)
// so the form can reject an invalid password before round-tripping to the server.
export function isPasswordValid(password) {
  return /^(?=.*[A-Za-z]).{6,}$/.test(password);
}
