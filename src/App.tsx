import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'

type Card = { id: string; image: string; title: string; depth: number; offset: number; active: boolean }
type Settings = {
  speed: number; direction: 'left' | 'right'; cardWidth: number; cardHeight: number; gap: number
  perspective: number; flow: boolean; wheel: boolean; dof: boolean; reducedMotion: boolean
}
type CaseStudy = { id: string; image: string; images: string[]; category: string; title: string; description: string; service?: string; year?: string; status?: string; url?: string }

const defaultCards: Card[] = [
  { id: '01', image: '/assets/card-07.jpg', title: 'Mana Poke', depth: -30, offset: 0, active: true },
  { id: '02', image: '/assets/card-08.png', title: 'Dona Cervejaria', depth: 80, offset: 100, active: true },
  { id: '03', image: '/assets/card-03.jpg', title: 'Centro Oeste Laticínio', depth: 50, offset: -20, active: true },
  { id: '04', image: '/assets/card-01.jpg', title: 'OS Turbo', depth: -50, offset: 120, active: true },
  { id: '05', image: '/assets/card-02.png', title: 'Checkin App', depth: -10, offset: 0, active: true },
  { id: '06', image: '/assets/card-04.png', title: 'Guardasol', depth: -40, offset: -90, active: true },
  { id: '07', image: '/assets/card-05.jpg', title: 'Santa Casa — Processos Seletivos', depth: 40, offset: -70, active: true },
  { id: '08', image: '/assets/card-06.png', title: 'Missão Criosfera 1', depth: 60, offset: 0, active: true },
  { id: '09', image: '/assets/cases/bfx-website/home-cover.png', title: 'BFX Empresarial', depth: -20, offset: 40, active: true },
  { id: '10', image: '/assets/card-10.png', title: 'BFX Empresarial — Identidade Visual', depth: 35, offset: -45, active: true },
  { id: '11', image: '/assets/cases/m4-logistica/home-cover.png', title: 'M4 Logística', depth: -5, offset: 70, active: true },
]

const defaultSettings: Settings = { speed: 1.5, direction: 'left', cardWidth: 407, cardHeight: 243, gap: 0, perspective: 501, flow: true, wheel: true, dof: true, reducedMotion: false }
const caseStudies: CaseStudy[] = [
  { id: 'centro-oeste', image: '/assets/card-03.jpg', images: ['/assets/cases/centro-oeste/ui-00.png', '/assets/cases/centro-oeste/ui-01.png', '/assets/cases/centro-oeste/ui-02.png', '/assets/cases/centro-oeste/ui-03.png', '/assets/cases/centro-oeste/ui-04.png', '/assets/cases/centro-oeste/ui-05.png', '/assets/cases/centro-oeste/ui-06.png'], category: 'Website', title: 'Centro Oeste Laticínio', description: 'Fundada em 1993, em Campolândia, Goiás, a Centro Oeste Laticínios começou produzindo queijos de alta qualidade e expandiu sua operação com uma moderna fábrica em Piranhas.', year: '2025', status: 'Finalizado', url: 'https://centrooestelaticinios.com.br/' },
  { id: 'mana-poke', image: '/assets/card-01.jpg', images: ['/assets/cases/mana-poke-updated/01.png', '/assets/cases/mana-poke-updated/02.png', '/assets/cases/mana-poke-updated/03.png', '/assets/cases/mana-poke-updated/04.png', '/assets/cases/mana-poke-updated/05.png', '/assets/cases/mana-poke-updated/06.png', '/assets/cases/mana-poke-updated/07.png', '/assets/cases/mana-poke-updated/08.png', '/assets/cases/mana-poke-updated/09.png', '/assets/cases/mana-poke-updated/10.png', '/assets/cases/mana-poke-updated/11.png'], category: 'Landing Page', title: 'Mana Poke', description: 'Em colaboração com a Barbas.digital, desenvolvemos um layout para a página dos franqueados da Mana Poke, com acesso simples a informações e recursos essenciais para suas operações.', service: 'UI / UX', year: '2023', url: 'https://www.figma.com/' },
  { id: 'dona', image: '/assets/card-02.png', images: ['/assets/cases/dona/01.png', '/assets/cases/dona/03.png'], category: 'Packshot 3D', title: 'Dona Cervejaria', description: 'Packshots 3D para os novos lançamentos da cervejaria, com atenção especial ao nível de detalhe necessário para representar cada material.', service: 'Modelo 3D', year: '2018', url: 'https://cervejariadona.com.br/' },
  { id: 'os-turbo', image: '/assets/card-04.png', images: ['/assets/cases/os-turbo/ui-01.png', '/assets/cases/os-turbo/ui-02.png', '/assets/cases/os-turbo/ui-03.png', '/assets/cases/os-turbo/ui-04.png', '/assets/cases/os-turbo/ui-05.png'], category: 'Website', title: 'OS Turbo', description: 'Sistema de gestão para oficinas que centraliza ordens de serviço, orçamentos, catálogo, checklist fotográfico, WhatsApp e relatórios financeiros.', year: '2025' },
  { id: 'checkin', image: '/assets/card-05.jpg', images: ['/assets/cases/checkin/original-01.png', '/assets/cases/checkin/original-02.png', '/assets/cases/checkin/original-03.png', '/assets/cases/checkin/original-04.png', '/assets/cases/checkin/original-05.png', '/assets/cases/checkin/original-06.png', '/assets/cases/checkin/original-07.png', '/assets/cases/checkin/original-08.png', '/assets/cases/checkin/original-09.png'], category: 'Sistema', title: 'Checkin App', description: 'Plataforma para administrar aluguéis de temporada do contrato ao check-in, com contratos digitais, portal do hóspede, gestão de imóveis, assinaturas e relatórios.', year: '2025' },
  { id: 'guardasol', image: '/assets/card-06.png', images: ['/assets/cases/guardasol/ui-01.png', '/assets/cases/guardasol/ui-02.png', '/assets/cases/guardasol/ui-03.png', '/assets/cases/guardasol/ui-04.png', '/assets/cases/guardasol/ui-05.png', '/assets/cases/guardasol/ui-06.png', '/assets/cases/guardasol/ui-07.png'], category: 'App', title: 'Guardasol', description: 'Sistema para operações de praia que centraliza pedidos, cardápio, estoque, guarda-sóis e a conta do cliente em um único painel.', year: '2025' },
  { id: 'santa-casa', image: '/assets/card-07.jpg', images: ['/assets/cases/santa-casa/ui-01.png', '/assets/cases/santa-casa/ui-02.png', '/assets/cases/santa-casa/ui-03.png', '/assets/cases/santa-casa/ui-04.png', '/assets/cases/santa-casa/ui-05.png', '/assets/cases/santa-casa/ui-06.png', '/assets/cases/santa-casa/ui-07.png'], category: 'Sistema', title: 'Santa Casa — Processos Seletivos', description: 'Plataforma de processos seletivos na área da saúde, com consulta de vagas, cargos, termos, datas de inscrição e arquivo histórico para candidatos.', year: '2026' },
  { id: 'criosfera', image: '/assets/card-08.png', images: ['/assets/cases/criosfera/ui-01.png', '/assets/cases/criosfera/ui-02.png', '/assets/cases/criosfera/ui-03.png', '/assets/cases/criosfera/ui-04.png', '/assets/cases/criosfera/ui-05.png', '/assets/cases/criosfera/ui-06.png'], category: 'Website', title: 'Missão Criosfera 1', description: 'Website para o primeiro laboratório remoto e autônomo de pesquisas do Brasil no centro da Antártica, coordenado pela UERJ/LARAMG com apoio de instituições científicas nacionais.', service: 'UI e Desenvolvimento', year: '2025', url: 'https://crio1missao25.com.br/' },
  { id: 'bfx-website', image: '/assets/card-09.png', images: ['/assets/cases/bfx-website/01.png', '/assets/cases/bfx-website/02.png', '/assets/cases/bfx-website/03.png', '/assets/cases/bfx-website/04.png', '/assets/cases/bfx-website/05.png'], category: 'Website', title: 'BFX Empresarial', description: 'Website institucional para uma empresa de manutenção e gestão predial, com foco em prevenção, controle, desempenho e atendimento técnico.', service: 'UI e Desenvolvimento', year: '2026', url: 'https://bfxempresarial.com.br/' },
  { id: 'bfx-identidade', image: '/assets/card-10.png', images: ['/assets/cases/bfx-identidade/01.png', '/assets/cases/bfx-identidade/02.png', '/assets/cases/bfx-identidade/03.png', '/assets/cases/bfx-identidade/04.png', '/assets/cases/bfx-identidade/05.png', '/assets/cases/bfx-identidade/06.png', '/assets/cases/bfx-identidade/07.png'], category: 'Identidade Visual', title: 'BFX Empresarial — Identidade Visual', description: 'Sistema visual completo para a BFX Empresarial, com diretrizes de marca, animações, cores, fotografia, aplicações e assinatura de e-mail.', service: 'Direção de arte', year: '2026', url: 'https://bfxempresarial.com.br/style-guide' },
  { id: 'm4-logistica', image: '/assets/cases/m4-logistica/cover-black.png', images: ['/assets/cases/m4-logistica/cover-black.png', '/assets/cases/m4-logistica/02.png', '/assets/cases/m4-logistica/03.png', '/assets/cases/m4-logistica/04.png'], category: 'Identidade Visual', title: 'M4 Logística', description: 'Projeto de marca para a M4 Logística, com uma identidade forte e funcional aplicada à comunicação, aos uniformes e aos materiais da operação.', service: 'Branding', year: '2026', url: 'https://m4logistica.framer.website/' },
]
const caseAnchorByCard: Record<string, string> = { '01': 'mana-poke', '02': 'dona', '03': 'centro-oeste', '04': 'os-turbo', '05': 'checkin', '06': 'guardasol', '07': 'santa-casa', '08': 'criosfera', '09': 'bfx-website', '10': 'bfx-identidade', '11': 'm4-logistica' }
const load = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }
const loadCards = () => {
  const saved = load<Card[]>('haus-cards', [])
  return defaultCards.map(card => {
    const stored = saved.find(item => item.id === card.id)
    return stored ? { ...card, depth: stored.depth, offset: stored.offset, active: stored.active } : card
  })
}

function Logo() {
  const logos = ['haus.art', 'haus.tech']
  const [logoIndex, setLogoIndex] = useState(0)
  const [typedLogo, setTypedLogo] = useState('')
  useEffect(() => {
    const fullLogo = logos[logoIndex]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTypedLogo(logos[0]); return }
    let index = 0
    let deleting = false
    let timer: number
    setTypedLogo('')
    const tick = () => {
      if (deleting) {
        index -= 1
        setTypedLogo(fullLogo.slice(0, index))
        if (index === 0) { setLogoIndex(current => (current + 1) % logos.length); return }
      } else {
        index += 1
        setTypedLogo(fullLogo.slice(0, index))
        if (index === fullLogo.length) deleting = true
      }
      timer = window.setTimeout(tick, index === fullLogo.length ? 1300 : deleting ? 75 : 135)
    }
    timer = window.setTimeout(tick, 700)
    return () => window.clearTimeout(timer)
  }, [logoIndex])
  return <a className="logo" href="/" aria-label="Haus início">
    <span className="logo-word" aria-live="polite">{typedLogo}<span className="logo-mark" aria-hidden="true" /></span>
  </a>
}

function Nav() {
  return <nav className="nav" aria-label="Navegação principal">
    <a href="/"><span>Home</span><span>Home</span><span>Home</span></a>
    <a href="/sobre"><span>Sobre</span><span>Sobre</span><span>Sobre</span></a>
    <a href="/cases"><span>Cases</span><span>Cases</span><span>Cases</span></a>
    <a href="/contato"><span>Contato</span><span>Contato</span><span>Contato</span></a>
  </nav>
}

function HomeDisplay() {
  const words = ['ficam.', 'conectam.', 'crescem.']
  const [activeWord, setActiveWord] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setActiveWord(word => (word + 1) % words.length), 2800)
    return () => window.clearInterval(timer)
  }, [])
  return <section className="home-display" aria-label="Manifesto da Haus">
    <p className="eyebrow">Estratégia · Forma · Presença</p>
    <h1><span>Marcas em movimento.</span><br /><span className="home-display-muted">Ideias que <span className="home-display-word" key={words[activeWord]}>{words[activeWord]}</span></span></h1>
  </section>
}

function Grid() {
  const gridRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const grid = gridRef.current
    const canvas = canvasRef.current
    if (!grid || !canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return
    const context = canvas.getContext('2d')
    if (!context) return
    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, targetX: window.innerWidth / 2, targetY: window.innerHeight / 2, active: false }
    let width = 0
    let height = 0
    let frame = 0
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const draw = (time: number) => {
      pointer.x += (pointer.targetX - pointer.x) * .08
      pointer.y += (pointer.targetY - pointer.y) * .08
      context.clearRect(0, 0, width, height)
      if (pointer.active) {
        const spacing = 20
        const step = 16
        const radius = 260
        const amplitude = 18
        const displace = (x: number, y: number) => {
          const dx = x - pointer.x
          const dy = y - pointer.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const influence = Math.max(0, 1 - distance / radius)
          if (influence <= 0) return { x, y, influence: 0 }
          const wave = Math.sin(distance * .055 - time * .004) * influence
          const push = wave * amplitude * influence
          const nx = distance ? dx / distance : 0
          const ny = distance ? dy / distance : 0
          return { x: x + nx * push, y: y + ny * push, influence }
        }
        const drawSegment = (x1: number, y1: number, x2: number, y2: number) => {
          const start = displace(x1, y1)
          const end = displace(x2, y2)
          const influence = Math.max(start.influence, end.influence)
          if (influence <= 0) return
          context.strokeStyle = `rgba(15, 219, 104, ${.12 + influence * .28})`
          context.beginPath()
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.stroke()
        }
        context.lineWidth = 1
        for (let x = 0; x <= width; x += spacing) for (let y = 0; y < height; y += step) drawSegment(x, y, x, Math.min(y + step, height))
        for (let y = 0; y <= height; y += spacing) for (let x = 0; x < width; x += step) drawSegment(x, y, Math.min(x + step, width), y)
      }
      frame = window.requestAnimationFrame(draw)
    }
    const move = (event: PointerEvent) => {
      pointer.targetX = event.clientX
      pointer.targetY = event.clientY
      pointer.active = true
      grid.style.setProperty('--grid-x', `${event.clientX}px`)
      grid.style.setProperty('--grid-y', `${event.clientY}px`)
      grid.style.setProperty('--grid-glow', '1')
    }
    const leave = () => { pointer.active = false; grid.style.setProperty('--grid-glow', '0') }
    resize()
    frame = window.requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerleave', leave)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); window.removeEventListener('pointerleave', leave) }
  }, [])
  return <div ref={gridRef} className="grid" aria-hidden="true"><canvas ref={canvasRef} className="grid-liquid" /></div>
}

function PageTransition() {
  const columns = typeof window === 'undefined' ? 80 : Math.ceil(window.innerWidth / 20) + 2
  const rows = typeof window === 'undefined' ? 50 : Math.ceil(window.innerHeight / 20) + 2
  const cubeColumns = Array.from({ length: columns }, (_, column) => <div className="transition-column" key={column} style={{ '--column': column } as CSSProperties}>
    {Array.from({ length: rows }, (_, row) => <i className="transition-cube" key={row} />)}
  </div>)
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a') : null
      const href = target?.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      const destination = new URL(href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return
      event.preventDefault()
      document.documentElement.classList.add('page-is-leaving')
      window.setTimeout(() => { window.location.assign(destination.href) }, 420)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])
  return <div className="page-transition" aria-hidden="true"><div className="transition-cubes">{cubeColumns}</div></div>
}

function ParallaxMarquee({ cards, settings }: { cards: Card[]; settings: Settings }) {
  const active = cards.filter(c => c.active)
  const track = useRef<HTMLDivElement>(null)
  const animationFrame = useRef<number>(0)
  const state = useRef({ x: 0, last: 0, pressed: false, dragging: false, moved: false, start: 0, origin: 0, pointerId: -1 })
  const [hover, setHover] = useState<string | null>(null)
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const animate = useCallback((time: number) => {
    const s = state.current
    const dt = Math.min(32, time - s.last || 16); s.last = time
    if (!s.dragging && !hover && !prefersReduced && !settings.reducedMotion) s.x += (settings.direction === 'left' ? -1 : 1) * settings.speed * dt * 0.05
    if (track.current) {
      const oneSet = (settings.cardWidth + settings.gap) * active.length
      let x = s.x % oneSet; if (x > 0) x -= oneSet
      track.current.style.transform = `translate3d(${x}px,-50%,0)`
    }
    animationFrame.current = requestAnimationFrame(animate)
  }, [active.length, hover, prefersReduced, settings])
  useEffect(() => {
    animationFrame.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame.current)
  }, [animate])
  useEffect(() => { const onWheel = (e: WheelEvent) => { if (settings.wheel) state.current.x -= e.deltaY * 0.35 }; window.addEventListener('wheel', onWheel, { passive: true }); return () => window.removeEventListener('wheel', onWheel) }, [settings.wheel])
  const pointerDown = (e: React.PointerEvent) => { if (e.target instanceof Element && e.target.closest('.project-card')) { state.current.moved = false; return } if (e.pointerType === 'mouse' && e.button !== 0) return; state.current.pressed = true; state.current.dragging = false; state.current.moved = false; state.current.pointerId = e.pointerId; state.current.start = e.clientX; state.current.origin = state.current.x }
  const pointerMove = (e: React.PointerEvent) => {
    const s = state.current
    if (!s.pressed || s.pointerId !== e.pointerId) return
    const delta = e.clientX - s.start
    if (!s.dragging && Math.abs(delta) > 12) {
      s.dragging = true
      s.moved = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (s.dragging) s.x = s.origin + delta
  }
  const pointerUp = (e: React.PointerEvent) => {
    const s = state.current
    if (s.pointerId === e.pointerId && s.dragging && (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    s.pressed = false
    s.dragging = false
  }
  const openCard = (event: React.MouseEvent<HTMLAnchorElement>, cardId: string) => {
    if (state.current.moved) { event.preventDefault(); state.current.moved = false; return }
    event.preventDefault()
    event.stopPropagation()
    const href = `/cases#case-${caseAnchorByCard[cardId]}`
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { window.location.assign(href); return }
    document.documentElement.classList.add('page-is-leaving')
    window.setTimeout(() => window.location.assign(href), 260)
  }
  const repeated = [...active, ...active]
  return <section className="marquee" style={{ perspective: settings.perspective }} aria-label="Projetos em destaque" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
    <div className="fade fade-left" /><div className="fade fade-right" />
    <div className="track" ref={track}>
      {repeated.map((card, i) => <a className="project-card" href={`/cases#case-${caseAnchorByCard[card.id]}`} aria-label={`Abrir case ${card.title}`} key={`${card.id}-${i}`} style={{ width: settings.cardWidth, height: settings.cardHeight, marginRight: settings.gap, transform: `translateY(${settings.flow ? card.offset + Math.sin(i * 1.3) * 8 : card.offset}px) translateZ(${card.depth}px)`, filter: hover === card.id ? 'none' : settings.dof ? `blur(${Math.min(3, Math.abs(card.depth) / 80)}px)` : undefined }} onClick={event => openCard(event, card.id)} onMouseEnter={() => setHover(card.id)} onMouseLeave={() => setHover(null)}>
        <img src={card.image} alt={card.title} draggable="false" />
        <span className={`card-caption ${hover === card.id ? 'is-visible' : ''}`}>{card.title}</span>
      </a>)}
    </div>
  </section>
}

function FloatingActions() {
  const [showTop, setShowTop] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const update = () => setShowTop(window.scrollY > 520)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = message.trim() || 'Olá! Gostaria de falar sobre um projeto.'
    window.open(`https://wa.me/5513981257487?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }
  return <div className="floating-actions">
    <div className={`whatsapp-widget ${isOpen ? 'is-open' : ''}`}>
      <form className="whatsapp-panel" onSubmit={sendMessage} aria-label="Enviar mensagem pelo WhatsApp">
        <strong>Fale com a Haus</strong>
        <label htmlFor="whatsapp-message">Como podemos ajudar?</label>
        <textarea id="whatsapp-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="Escreva sua pergunta..." rows={3} />
        <button type="submit">Enviar pelo WhatsApp <span aria-hidden="true">↗</span></button>
      </form>
      <button className="whatsapp-float" type="button" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen} aria-controls="whatsapp-message" aria-label={isOpen ? 'Fechar WhatsApp' : 'Falar com a Haus pelo WhatsApp'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.1 1.6 5.8L.2 24l6.6-1.7a11.8 11.8 0 0 0 5.3 1.3h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.3-6.1-3.5-8.3ZM12.1 21.5c-1.7 0-3.4-.5-4.8-1.3l-.3-.2-3.9 1 1-3.8-.2-.4a9.7 9.7 0 1 1 8.2 4.7Zm5.3-7.2c-.3-.2-1.8-.9-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-1 .9-.2.1-.4.1-.7 0-.3-.2-1.2-.4-2.2-1.3-.8-.7-1.3-1.5-1.5-1.8-.2-.3 0-.5.2-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.8.8.3 1.4.5 1.9.7.8.2 1.5.2 2 .1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.1-1.4 0-.2-.2-.3-.5-.4Z" /></svg>
      </button>
    </div>
    <button className={`back-to-top ${showTop ? 'is-visible' : ''}`} type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar para o topo">↑</button>
  </div>
}

function Footer() { return <footer><a href="mailto:contato@haus.art.br">contato@haus.art.br</a><a href="#instagram">Insta</a></footer> }

function Home({ cards, settings }: { cards: Card[]; settings: Settings }) { return <main className="page"><Grid /><header><Logo /><Nav /></header><HomeDisplay /><ParallaxMarquee cards={cards} settings={settings} /><Footer /></main> }

function Cases() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.case-item'))
    if (!('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: .16, rootMargin: '0px 0px -8% 0px' })
    items.forEach(item => observer.observe(item))
    return () => observer.disconnect()
  }, [])
  return <main className="cases-page">
    <Grid />
    <header><Logo /><Nav /></header>
    <section className="cases-intro">
      <p className="eyebrow">Haus / Cases</p>
      <h1><span className="display-line">Ideias que</span><br /><span className="display-line display-line-muted">ganham forma.</span></h1>
      <p className="cases-lede">Criamos identidades, experiências e histórias para marcas que querem deixar uma impressão real.</p>
    </section>
    <section className="cases-grid" aria-label="Projetos selecionados">
      {caseStudies.map((project, index) => <article className={`case-item case-item-${index % 4}`} id={`case-${project.id}`} key={project.id}>
        <CaseGallery project={project} />
        <div className="case-copy">
          <p className="eyebrow">{project.category}</p>
          <h2>{project.title}</h2>
          {(project.service || project.year || project.status) && <div className="case-meta">{project.service && <span>{project.service}</span>}{project.year && <span>{project.year}</span>}{project.status && <span>{project.status}</span>}</div>}
          <p>{project.description}</p>
          <a className="case-link" href={project.url || `#case-${project.id}`} target={project.url ? '_blank' : undefined} rel={project.url ? 'noreferrer' : undefined}>Ver projeto <span aria-hidden="true">↗</span></a>
        </div>
      </article>)}
    </section>
    <Footer />
  </main>
}

function Contact() {
  const [sent, setSent] = useState(false)
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true) }
  return <main className="contact-page">
    <Grid />
    <header><Logo /><Nav /></header>
    <section className="contact-layout">
      <div className="contact-intro">
        <p className="eyebrow">Haus / Contato</p>
        <h1><span className="display-line">Vamos criar</span><br /><span className="display-line display-line-muted">algo juntos?</span></h1>
        <p>Conte um pouco sobre o seu próximo projeto. A gente responde em até dois dias úteis.</p>
        <a className="contact-email" href="mailto:contato@haus.art.br">contato@haus.art.br <span aria-hidden="true">↗</span></a>
      </div>
      <form className="contact-form" onSubmit={submit}>
        <label>Nome<input name="name" type="text" placeholder="Seu nome" required /></label>
        <label>E-mail<input name="email" type="email" placeholder="voce@empresa.com" required /></label>
        <label>Empresa<input name="company" type="text" placeholder="Nome da empresa" /></label>
        <label>Mensagem<textarea name="message" placeholder="Como podemos ajudar?" rows={5} required /></label>
        <button type="submit">{sent ? 'Mensagem enviada ✓' : 'Enviar mensagem ↗'}</button>
      </form>
    </section>
    <Footer />
  </main>
}

function CaseGallery({ project }: { project: CaseStudy }) {
  const [active, setActive] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const isDigital = ['Website', 'Landing Page', 'Produto digital', 'Sistema', 'App'].includes(project.category)
  const next = () => setActive(index => (index + 1) % project.images.length)
  const previous = () => setActive(index => (index - 1 + project.images.length) % project.images.length)
  useEffect(() => {
    if (isPaused || project.images.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(next, 4000)
    return () => window.clearInterval(timer)
  }, [isPaused, project.images.length])
  return <div className="case-gallery" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocusCapture={() => setIsPaused(true)} onBlurCapture={() => setIsPaused(false)}>
    <div className={`case-device ${isDigital ? 'is-line-frame' : ''}`}>
      <div className="case-device-screen">
        {isDigital && <i className="case-device-camera" aria-hidden="true" />}
        {isDigital && <div className="case-browser-bar" aria-hidden="true"><span className="case-browser-dots"><i /><i /><i /></span><span>haus.art.br / {project.id}</span><b>{project.service || 'Digital experience'}</b></div>}
        <div className={`case-gallery-stage ${isDigital ? 'is-digital' : ''}`}>
          <div className="case-gallery-track" style={{ transform: `translateY(-${active * 100}%)` }}>
            {project.images.map((image, index) => <img className={project.id === 'm4-logistica' && index === 0 ? 'is-m4-cover' : undefined} key={image} src={image} alt={`${project.title} — imagem ${index + 1}`} />)}
          </div>
          {project.id === 'bfx-identidade' && active === 0 && <div className="case-brand-cover"><img src="/assets/logo-bfx-dark.svg" alt="BFX Empresarial" /></div>}
          {project.id === 'checkin' && <div className={`case-redactions case-redactions-${active}`} aria-hidden="true">
            {active === 0 && <i className="case-redaction checkin-home-name" />}
            {active === 4 && <>
              <i className="case-redaction checkin-contract-name-1" /><i className="case-redaction checkin-contract-name-2" /><i className="case-redaction checkin-contract-name-3" /><i className="case-redaction checkin-contract-name-4" />
              <i className="case-redaction checkin-contract-name-5" /><i className="case-redaction checkin-contract-name-6" /><i className="case-redaction checkin-contract-name-7" /><i className="case-redaction checkin-contract-name-8" />
            </>}
            {active === 7 && <>
              <i className="case-redaction checkin-signature-name-1" /><i className="case-redaction checkin-signature-cpf-1" />
              <i className="case-redaction checkin-signature-name-2" /><i className="case-redaction checkin-signature-cpf-2" />
            </>}
          </div>}
          <div className="case-gallery-controls">
            <button type="button" onClick={previous} aria-label={`Imagem anterior de ${project.title}`}>←</button>
            <span><b>{String(active + 1).padStart(2, '0')}</b> / {String(project.images.length).padStart(2, '0')}</span>
            <button type="button" onClick={next} aria-label={`Próxima imagem de ${project.title}`}>→</button>
          </div>
        </div>
      </div>
      {isDigital && <div className="case-device-base" aria-hidden="true"><i /></div>}
    </div>
    <div className="case-gallery-dots" aria-label={`Selecionar imagem de ${project.title}`}>
      {project.images.map((image, index) => <button type="button" className={index === active ? 'is-active' : ''} key={image} onClick={() => setActive(index)} aria-label={`Ver imagem ${index + 1}`} />)}
    </div>
  </div>
}

function TechnologySection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const technologies = [
    ['Gemini', 'AI e prototipação', 'gemini', '/assets/technologies/gemini.svg'],
    ['Firebase', 'Produtos conectados', 'firebase', '/assets/technologies/firebase.svg'],
    ['Figma', 'Sistemas de interface', 'figma', '/assets/technologies/figma.svg'],
    ['OpenAI', 'Inteligência aplicada', 'openai', '/assets/technologies/openai.svg'],
    ['AWS', 'Infraestrutura', 'aws', '/assets/technologies/aws.svg'],
    ['Google Cloud', 'Dados e escala', 'google', '/assets/technologies/google-cloud.svg'],
    ['Framer', 'Experiências web', 'framer', '/assets/technologies/framer.svg'],
    ['Blender', 'Imagem e 3D', 'blender', '/assets/technologies/blender.svg'],
  ]
  useEffect(() => {
    const section = sectionRef.current
    if (!section || !('IntersectionObserver' in window)) { setIsVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setIsVisible(true)
      observer.disconnect()
    }, { threshold: .16 })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])
  return <section ref={sectionRef} className={`about-technologies ${isVisible ? 'is-visible' : ''}`} aria-label="Tecnologias">
    <div className="about-technologies-heading">
      <p className="eyebrow">Tecnologias</p>
      <p>Ferramentas para transformar uma boa ideia em uma experiência que continua viva depois do lançamento.</p>
    </div>
    <div className="technology-grid">
      {technologies.map(([name, description, kind, icon], index) => <div className="technology-item" key={name} style={{ '--tech-delay': `${index * 65}ms` } as CSSProperties}>
        <span className={`technology-mark technology-mark-${kind}`} aria-hidden="true"><img src={icon} alt="" loading="lazy" /></span>
        <span><strong>{name}</strong><small>{description}</small></span>
      </div>)}
    </div>
  </section>
}

function About() {
  const services = ['Estratégia de marca', 'Identidade visual', 'Experiências digitais', 'Direção de arte']
  const steps = [
    ['01', 'Escuta', 'Entendemos o contexto, as ambições e o que torna cada negócio único.'],
    ['02', 'Ideia', 'Transformamos descobertas em uma direção clara, relevante e possível.'],
    ['03', 'Forma', 'Construímos sistemas visuais e experiências que continuam fazendo sentido.'],
  ]
  return <main className="about-page">
    <Grid />
    <header><Logo /><Nav /></header>
    <section className="about-hero">
      <p className="eyebrow">Haus / Sobre</p>
      <h1><span className="display-line">Design para</span><br /><span className="display-line display-line-muted">deixar marca.</span></h1>
      <p className="about-lede">A Haus é um estúdio independente que transforma estratégia em identidades, experiências e histórias com personalidade.</p>
    </section>
    <section className="about-manifesto">
      <p className="eyebrow">O que fazemos</p>
      <div><p>Trabalhamos perto de pessoas e negócios que acreditam que uma boa ideia merece ganhar uma forma à altura.</p><p>Combinamos pensamento estratégico, cultura visual e tecnologia para criar marcas que se movem com o mundo.</p></div>
    </section>
    <section className="about-services" aria-label="Serviços">
      {services.map((service, index) => <div className="about-service" key={service}><span>0{index + 1}</span><h2>{service}</h2><b aria-hidden="true">↗</b></div>)}
    </section>
    <TechnologySection />
    <section className="about-process">
      <div><p className="eyebrow">Como trabalhamos</p><h2><span className="display-line">Clareza antes</span><br /><span className="display-line display-line-muted">de tudo.</span></h2></div>
      <div className="process-list">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>
    <section className="about-cta"><p className="eyebrow">Tem um projeto?</p><h2><span className="display-line">Vamos conversar</span><br /><span className="display-line display-line-muted">sobre ele.</span></h2><a className="case-link" href="/contato">Entrar em contato <span aria-hidden="true">↗</span></a></section>
    <Footer />
  </main>
}

function Admin() {
  const [cards, setCards] = useState(loadCards); const [settings, setSettings] = useState(() => load('haus-settings', defaultSettings)); const [saved, setSaved] = useState(false)
  const save = () => { localStorage.setItem('haus-cards', JSON.stringify(cards)); localStorage.setItem('haus-settings', JSON.stringify(settings)); setSaved(true); setTimeout(() => setSaved(false), 1800) }
  const reset = () => { setCards(defaultCards); setSettings(defaultSettings); localStorage.removeItem('haus-cards'); localStorage.removeItem('haus-settings') }
  const update = (id: string, patch: Partial<Card>) => setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))
  return <div className="admin-shell"><div className="admin-top"><Logo /><a href="/">Voltar para o site</a></div><div className="admin-content"><div className="admin-heading"><p className="eyebrow">Haus / Admin</p><h1>ParallaxMarquee</h1><p>Gerencie os projetos e o movimento da Home.</p></div><div className="admin-grid"><section className="panel"><h2>Cards</h2>{cards.map(c => <div className="card-row" key={c.id}><img src={c.image} alt="" /><label><span>{c.id} — título</span><input value={c.title} onChange={e => update(c.id, { title: e.target.value })} /></label><label><span>Profundidade</span><input type="number" value={c.depth} onChange={e => update(c.id, { depth: Number(e.target.value) })} /></label><button className={c.active ? 'toggle active' : 'toggle'} onClick={() => update(c.id, { active: !c.active })}>{c.active ? 'Ativo' : 'Off'}</button></div>)}</section><section className="panel settings"><h2>Animação</h2><label><span>Velocidade <b>{settings.speed}</b></span><input type="range" min="0" max="5" step="0.1" value={settings.speed} onChange={e => setSettings({ ...settings, speed: Number(e.target.value) })} /></label><label><span>Direção</span><select value={settings.direction} onChange={e => setSettings({ ...settings, direction: e.target.value as Settings['direction'] })}><option value="left">Esquerda</option><option value="right">Direita</option></select></label><label><span>Largura <b>{settings.cardWidth}px</b></span><input type="range" min="220" max="520" value={settings.cardWidth} onChange={e => setSettings({ ...settings, cardWidth: Number(e.target.value) })} /></label><label><span>Altura <b>{settings.cardHeight}px</b></span><input type="range" min="150" max="320" value={settings.cardHeight} onChange={e => setSettings({ ...settings, cardHeight: Number(e.target.value) })} /></label><label className="check"><input type="checkbox" checked={settings.flow} onChange={e => setSettings({ ...settings, flow: e.target.checked })} /> Flow vertical</label><label className="check"><input type="checkbox" checked={settings.wheel} onChange={e => setSettings({ ...settings, wheel: e.target.checked })} /> Wheel scroll</label><label className="check"><input type="checkbox" checked={settings.dof} onChange={e => setSettings({ ...settings, dof: e.target.checked })} /> Depth of field</label></section></div><div className="admin-actions"><button onClick={reset}>Restaurar padrão</button><button className="primary" onClick={save}>{saved ? 'Salvo ✓' : 'Salvar alterações'}</button></div></div></div>
}

export function App() { const [cards] = useState(loadCards); const [settings] = useState(() => load('haus-settings', defaultSettings)); const path = window.location.pathname; let content: ReactElement; if (path === '/admin') content = <Admin />; else if (path === '/cases') content = <Cases />; else if (path === '/contato') content = <Contact />; else if (path === '/sobre') content = <About />; else content = <Home cards={cards} settings={settings} />; return <><PageTransition />{content}{path !== '/admin' && <FloatingActions />}</> }
