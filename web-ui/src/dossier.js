export function writtenChapters(project) {
  return (project?.chapters || []).filter((c) => String(c.body || '').trim())
    .slice().sort((a, b) => Number(a.id) - Number(b.id))
}

export function dossierPending(project) {
  const meta = project?.memory?.story_dossier_meta || {}
  const written = writtenChapters(project)
  return Boolean(meta.pending || written.some((c) => !Object.hasOwn(meta.chapterRevisions || {}, c.id)
    || Number(meta.chapterRevisions[c.id]) !== Number(c.revision || 0))
    || (meta.sourceChapterIds || []).some((id) => !written.some((c) => c.id === id)))
}

export function mergeDossierResult(project, response) {
  if (!project || response.projectId !== project.id) return project
  const previous = project.memory?.story_dossier_meta || {}
  const incoming = response.memory?.story_dossier_meta || {}
  if (previous.updatedAt && incoming.updatedAt && previous.updatedAt > incoming.updatedAt) return project
  const next = { ...project, memory: { ...project.memory,
    story_dossier: response.dossier,
    story_dossier_meta: incoming,
  } }
  next.memory.story_dossier_meta = { ...incoming, pending: dossierPending(next) }
  return next
}
