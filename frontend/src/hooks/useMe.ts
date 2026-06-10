import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, getStoredTokens, type User } from '@/api/auth'

export const meKey = () => ['me'] as const

/**
 * Fetches the current user. Wraps `fetchCurrentUser(accessToken)` by reading
 * the stored access token from localStorage. Disabled when no token is present.
 */
export function useMe(enabled = true) {
  const { accessToken } = getStoredTokens()
  return useQuery<User>({
    queryKey: meKey(),
    queryFn: () => fetchCurrentUser(accessToken!),
    enabled: enabled && !!accessToken,
  })
}
