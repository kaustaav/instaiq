import { useCallback } from 'react'
import { useNavigate } from 'react-router'

/** History state carried to the profile so its back link can return to where the user came from. */
export type ProfileNavState = { backLabel: string }

export function useOpenProfile(backLabel: string) {
  const navigate = useNavigate()
  return useCallback(
    (id: number) => navigate(`/influencers/${id}`, { state: { backLabel } satisfies ProfileNavState }),
    [navigate, backLabel],
  )
}
