import { useThemeContext } from '@/components/shell/ThemeProvider'

export function useAccent() {
  const { accent, setAccent } = useThemeContext()
  return { accent, setAccent }
}
