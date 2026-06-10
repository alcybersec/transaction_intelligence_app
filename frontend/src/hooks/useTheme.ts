import { useThemeContext } from '@/components/shell/ThemeProvider'

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeContext()
  return { theme, setTheme, toggle: toggleTheme }
}
