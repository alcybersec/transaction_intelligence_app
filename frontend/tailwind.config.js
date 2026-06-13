/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['attribute', 'data-theme="dark"'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-grad-1": "var(--bg-grad-1)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          fg: "var(--accent-fg)",
          soft: "var(--accent-soft)",
          ring: "var(--accent-ring)",
        },
        debit: {
          DEFAULT: "var(--debit)",
          soft: "var(--debit-soft)",
        },
        credit: "var(--credit)",
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
        },
        c1: "var(--c1)",
        c2: "var(--c2)",
        c3: "var(--c3)",
        c4: "var(--c4)",
        c5: "var(--c5)",
        c6: "var(--c6)",
        c7: "var(--c7)",
        c8: "var(--c8)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        maxw: "var(--maxw)",
      },
      animation: {
        fadeUp: "fadeUp 240ms ease-out",
        fadeIn: "fadeIn 160ms ease-out",
        popIn: "popIn 200ms ease-out",
        growBar: "growBar 420ms ease-out",
        spin: "spin 1s linear infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
}
