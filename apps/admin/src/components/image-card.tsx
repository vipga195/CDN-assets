'use client'

import { useState } from 'react'
import { remove } from './actions'
import type { Img } from '../services/lib/api'

const WIDTHS = [64, 128, 256, 512, 1024, 2048]
const FORMATS = ['', 'avif', 'webp', 'orig'] // '' = follow the viewer's Accept

export default function ImageCard({ img, cdn }: { img: Img; cdn: string }) {
  const [w, setW] = useState(512)
  const [fmt, setFmt] = useState('')
  const link = `${cdn}/i/${img.id}?w=${w}${fmt ? `&fmt=${fmt}` : ''}`

  return (
    <li>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${cdn}/i/${img.id}?w=256`} alt={img.filename} width={160} />
      <div>{img.filename} ({img.width}x{img.height}, {Math.round(img.size_bytes / 1024)} KB)</div>
      <select value={w} onChange={(e) => setW(Number(e.target.value))}>
        {WIDTHS.map((x) => <option key={x}>{x}</option>)}
      </select>
      <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
        {FORMATS.map((x) => <option key={x} value={x}>{x || 'auto'}</option>)}
      </select>
      <button onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
      <form action={remove.bind(null, img.id)}>
        <button>Xoá</button>
      </form>
    </li>
  )
}