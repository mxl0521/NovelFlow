import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writtenChapters, dossierPending, mergeDossierResult } from '../web-ui/src/dossier.js'

test('planned chapters do not hide the latest written chapter', () => {
  assert.deepEqual(writtenChapters({ chapters: [{ id: '10', body: '正文' }, { id: '03', body: '' }, { id: '02', body: '正文' }] }).map((c) => c.id), ['02', '10'])
})

test('late dossier results preserve new prose and keep its sync pending', () => {
  const project = { id: 'book', chapters: [{ id: '04', body: '新正文', revision: 2 }], memory: { other: '保留' } }
  const result = mergeDossierResult(project, { projectId: 'book', dossier: { synopsis: '资料' }, memory: { story_dossier_meta: { chapterRevisions: { '04': 1 }, sourceChapterIds: ['04'] } } })
  assert.equal(result.chapters[0].body, '新正文')
  assert.equal(result.memory.other, '保留')
  assert.equal(dossierPending(result), true)
})

test('another book or an older task cannot replace current dossier', () => {
  const project = { id: 'book', memory: { story_dossier: { synopsis: '较新资料' }, story_dossier_meta: { updatedAt: '2026-10-23T01:00:00Z' } } }
  assert.equal(mergeDossierResult(project, { projectId: 'other' }), project)
  assert.equal(mergeDossierResult(project, { projectId: 'book', memory: { story_dossier_meta: { updatedAt: '2026-10-23T00:00:00Z' } } }), project)
})
