import { useState } from 'react'
import './LandingPage.css'

function LandingPage({ onStart }) {
  const [idea, setIdea] = useState('')

  return (
    <main className="landing-page">
      <div className="landing-grain" aria-hidden="true" />
      <header className="landing-brand"><span className="landing-feather" aria-hidden="true">╱</span><strong>NovelFlow</strong></header>
      <div className="landing-quill" aria-hidden="true" />
      <section className="landing-copy">
        <h1>每一个想法，<br />都是一段未写完的故事。</h1>
        <p className="landing-subtitle">把灵感写下来，让它慢慢长成一个完整的世界。</p>
      </section>
      <section className="landing-paper" aria-labelledby="landing-title">
        <span className="landing-paper-mark" aria-hidden="true">╱</span>
        <h2 id="landing-title">写下你的想法，<br />让它成为一个故事</h2>
        <label className="landing-input-wrap" htmlFor="landing-idea">
          <span className="sr-only">故事想法</span>
          <textarea id="landing-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="在这里写下你的灵感、情节、人物、世界观……" rows="4" />
        </label>
        <button type="button" className="landing-start" onClick={() => onStart(idea.trim())}>
          <span aria-hidden="true">╱</span>
          开始创作
        </button>
      </section>
      <p className="landing-quote">“文字是时间的礼物，而故事是你的回声。”<br /><cite>— Jean Giono</cite></p>
      <footer className="landing-footer"><span className="landing-feather" aria-hidden="true">╱</span> NovelFlow</footer>
    </main>
  )
}

export default LandingPage
