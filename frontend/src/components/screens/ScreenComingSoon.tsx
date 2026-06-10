interface Props {
  name: string
}

export function ScreenComingSoon({ name }: Props) {
  return (
    <div className="max-w-maxw mx-auto px-5 py-10 text-center">
      <div className="font-serif text-2xl mb-2">{name}</div>
      <div className="text-text-2 text-sm">Coming soon in Phase 3.</div>
    </div>
  )
}
