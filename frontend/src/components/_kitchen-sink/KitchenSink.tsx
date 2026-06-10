import { Card } from '../primitives/Card'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'
import { Toggle } from '../primitives/Toggle'
import { Segmented } from '../primitives/Segmented'
import { Input } from '../primitives/Input'
import { Field } from '../primitives/Field'
import { Select } from '../primitives/Select'
import { Avatar } from '../primitives/Avatar'
import { IconTile } from '../primitives/IconTile'
import { Modal } from '../primitives/Modal'
import { useToast } from '../primitives/ToastContext'
import { Icon } from '../icons/Icon'
import { Donut } from '../charts/Donut'
import { AreaTrend } from '../charts/AreaTrend'
import { Sparkline } from '../charts/Sparkline'
import { Ring } from '../charts/Ring'
import { MiniBars } from '../charts/MiniBars'
import { Progress } from '../charts/Progress'
import { Heatmap } from '../charts/Heatmap'
import { useState } from 'react'

export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false)
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [toggle, setToggle] = useState(false)
  const { show } = useToast()

  return (
    <div className="max-w-maxw mx-auto px-5 py-8 space-y-8">
      <h1 className="font-serif text-3xl">Kitchen Sink</h1>
      <div className="text-text-2">Visual gallery of v2 primitives and charts. Dev-only.</div>

      <section>
        <h2 className="font-serif text-xl mb-3">Buttons</h2>
        <Card>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Badges</h2>
        <Card>
          <div className="flex gap-2 flex-wrap">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="debit">Debit</Badge>
            <Badge tone="credit">Credit</Badge>
            <Badge tone="warn">Warning</Badge>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Form primitives</h2>
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Username"><Input placeholder="alex" /></Field>
            <Field label="Category" hint="optional">
              <Select options={[{ value: 'food', label: 'Food' }, { value: 'travel', label: 'Travel' }]} />
            </Field>
            <div className="flex items-center gap-3">
              <Toggle checked={toggle} onChange={setToggle} label="Toggle" />
            </div>
            <Segmented
              options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]}
              value={seg}
              onChange={setSeg}
            />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Avatars + Icon Tiles</h2>
        <Card>
          <div className="flex gap-3 items-center">
            <Avatar name="Alex" />
            <Avatar name="Jane Doe" size={48} />
            <IconTile name="arrow-down-right" tone="debit" />
            <IconTile name="arrow-up-right" tone="credit" />
            <IconTile name="warning" tone="warn" />
            <Icon name="sparkles" size={22} />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Modal & Toast</h2>
        <Card>
          <div className="flex gap-2">
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            <Button onClick={() => show('Saved', 'accent')}>Show Toast</Button>
          </div>
        </Card>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Hello">
          <p className="text-sm text-text-2">Modal body content goes here.</p>
        </Modal>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Charts</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-serif text-lg mb-2">Donut</h3>
            <Donut
              data={[
                { label: 'Food', amount: 800, color: 'var(--c1)' },
                { label: 'Travel', amount: 400, color: 'var(--c2)' },
                { label: 'Other', amount: 300, color: 'var(--c3)' },
              ]}
              centerLabel="Total"
              centerAmount="1,500.00"
              centerSuffix="AED"
            />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Sparkline</h3>
            <Sparkline values={[3, 5, 2, 7, 4, 6, 8, 6]} width={200} height={48} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Ring</h3>
            <div className="flex gap-3 items-center">
              <Ring value={30} max={100} centerLabel="30%" />
              <Ring value={92} max={100} centerLabel="92%" />
              <Ring value={120} max={100} centerLabel="120%" />
            </div>
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">MiniBars</h3>
            <MiniBars bars={[{ label: 'Mon', value: 4 }, { label: 'Tue', value: 7 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 8 }]} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Progress</h3>
            <Progress value={45} max={100} />
            <div className="h-2" />
            <Progress value={92} max={100} />
            <div className="h-2" />
            <Progress value={120} max={100} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">AreaTrend</h3>
            <AreaTrend current={[10, 25, 35, 50, 65, 70]} previous={[15, 28, 32, 40, 55, 60]} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Heatmap</h3>
            <Heatmap
              cells={Array.from({ length: 56 }).map((_, i) => {
                const d = new Date(2026, 0, 1 + i)
                const iso = d.toISOString().slice(0, 10)
                // Pseudo-random intensity, deterministic per index.
                const value = (i * 37) % 11
                return { date: iso, value }
              })}
            />
          </Card>
        </div>
      </section>
    </div>
  )
}
