// ============================================================================
// Password strength scorer — pure, exported for unit testing.
// ============================================================================

export type PasswordStrength = 'weak' | 'medium' | 'strong'

export function scorePassword(pw: string): PasswordStrength {
  if (!pw) return 'weak'
  let classes = 0
  if (/[a-z]/.test(pw)) classes++
  if (/[A-Z]/.test(pw)) classes++
  if (/\d/.test(pw)) classes++
  if (/[^A-Za-z0-9]/.test(pw)) classes++

  if (pw.length >= 12 && classes >= 3) return 'strong'
  if (pw.length >= 8 && classes >= 2) return 'medium'
  return 'weak'
}
