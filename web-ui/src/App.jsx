import React, { useState } from 'react'
import appStyles from './App.css?inline'
import LandingPage from './LandingPage.jsx'

function applyWorkspaceStyles(frame, initialIdea = '') {
  const document = frame.contentDocument
  if (!document || document.getElementById('novelflow-source-styles')) return

  const style = document.createElement('style')
  style.id = 'novelflow-source-styles'
  style.textContent = appStyles
  document.head.append(style)

  if (initialIdea) {
    const ideaInput = document.querySelector('#home-story-idea')
    if (ideaInput) {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(ideaInput, initialIdea)
      ideaInput.dispatchEvent(new window.Event('input', { bubbles: true }))
    }
  }

  const bindBeginnerGuide = () => {
    const guide = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('新手使用指南'))
    if (!guide || guide.dataset.sourceGuideBound === 'true') return

    guide.dataset.sourceGuideBound = 'true'
    guide.addEventListener('click', () => {
      const chatTab = [...document.querySelectorAll('.assistant-tabs button')].find((button) => button.textContent.includes('对话'))
      chatTab?.click()
      const input = document.querySelector('.assistant-composer textarea')
      if (!input) return
      const prompt = '我是新手，请一步一步告诉我如何从一个故事想法开始创建第一部小说。'
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(input, prompt)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
      input.focus()
    })
  }

  const bindHomeNavigation = () => {
    const homeButton = [...document.querySelectorAll('.home-primary-nav button, .primary-nav button')]
      .find((button) => button.textContent.includes('创作首页'))
    const isHome = Boolean(document.querySelector('.v3-home'))
    let backButton = document.querySelector('.source-home-back')

    if (isHome) {
      backButton?.remove()
      return
    }
    if (!homeButton) return
    if (!backButton) {
      backButton = document.createElement('button')
      backButton.type = 'button'
      backButton.className = 'source-home-back'
      backButton.textContent = '返回首页'
      backButton.addEventListener('click', () => homeButton.click())
      document.querySelector('.topbar')?.prepend(backButton)
    }
  }

  const bindHomeScene = () => {
    const home = document.querySelector('.v3-home')
    const workspace = document.querySelector('.workspace')
    const existingScene = workspace?.querySelector('.source-home-scene')
    if (!home) {
      existingScene?.remove()
      return
    }
    if (!workspace || existingScene) return

    const scene = document.createElement('section')
    scene.className = 'source-home-scene'
    scene.setAttribute('aria-hidden', 'true')
    scene.innerHTML = '<span class="source-home-scene-kicker">NovelFlow</span><strong>每一个想法，<br>都是一段未写完的故事。</strong><span class="source-home-scene-mark">✦</span><small>从一页空白，到一个完整的世界。</small>'
    workspace.prepend(scene)
  }

  bindBeginnerGuide()
  bindHomeNavigation()
  bindHomeScene()
  new MutationObserver(() => {
    bindBeginnerGuide()
    bindHomeNavigation()
    bindHomeScene()
  }).observe(document.body, { childList: true, subtree: true })
}

export default function App() {
  const [started, setStarted] = useState(false)
  const [initialIdea, setInitialIdea] = useState('')

  if (!started) return <LandingPage onStart={(idea) => { setInitialIdea(idea); setStarted(true) }} />

  return <iframe className="novelflow-legacy-frame" title="NovelFlow" src="/novelflow-legacy.html" onLoad={(event) => applyWorkspaceStyles(event.currentTarget, initialIdea)} />
}