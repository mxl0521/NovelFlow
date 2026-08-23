import { Feather } from 'lucide-react'
import { useState } from 'react'
import heroFeather from './assets/1.png'
import './LandingPage.css'

function LandingPage({ onStart }) {
  const [idea, setIdea] = useState('')

  return (
    <main className="landing-page">
      <div className="landing-grain" aria-hidden="true" />
      <header className="landing-brand"><Feather size={23} strokeWidth={1.65} aria-hidden="true" /><strong>NovelFlow</strong></header>
      <section className="hero-composition" aria-labelledby="landing-hero-title">
        <div className="hero-copy">
          <h1 id="landing-hero-title"><span className="hero-title-line hero-title-line--1"><span className="hero-title-line-inner">每一个想法，</span></span><span className="hero-title-line hero-title-line--2"><span className="hero-title-line-inner">都是一段未写完的故事。</span></span></h1>
          <p className="landing-subtitle">把灵感写下来，让它慢慢长成一个完整的世界。</p>
        </div>
        <div className="hero-quill-wrap"><img className="landing-hero-quill" src={heroFeather} alt="" aria-hidden="true" /></div>
      </section>
      <section className="landing-paper" aria-labelledby="landing-title">
        <Feather className="landing-paper-mark" size={22} strokeWidth={1.35} aria-hidden="true" />
        <h2 id="landing-title">写下你的想法，<br />让它成为一个故事</h2>
        <label className="landing-input-wrap" htmlFor="landing-idea">
          <span className="sr-only">故事想法</span>
          <textarea id="landing-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="在这里写下你的灵感、情节、人物、世界观……" rows="4" />
        </label>
        <button type="button" className="landing-start" onClick={() => onStart(idea.trim())}>
          <Feather size={18} strokeWidth={1.7} aria-hidden="true" />
          开始创作
        </button>
      </section>
      <p className="landing-quote">“文字是时间的礼物，而故事是你的回声。”<br /><cite>— Jean Giono</cite></p>
      <footer className="landing-footer"><Feather size={19} strokeWidth={1.65} aria-hidden="true" /> NovelFlow</footer>
    </main>
  )
}

export default LandingPage
