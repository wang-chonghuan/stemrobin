import { createServerFn } from '@tanstack/react-start'
import { createStemSupabaseClient } from '~/lib/supabase'

// Metadata for the lesson view header. The lesson body itself is the static
// HTML at public/lessons/<id>.html (loaded in an iframe); this only supplies the
// title / status shown around it.
export type LessonMeta = {
  id: string
  subject: 'math' | 'physics'
  stage: number
  order: number
  title: string
  concept: string
  status: 'draft' | 'published'
}

// Fetches one lesson's metadata by id. Tolerant: returns null if the schema is
// not exposed or the row is missing — the lesson view still loads the static
// HTML by id either way.
export const getLesson = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<LessonMeta | null> => {
    try {
      const supabase = createStemSupabaseClient()
      const { data, error } = await supabase
        .from('sr_lessons')
        .select('id, subject, stage, lesson_order, title, concept, status')
        .eq('id', id)
        .maybeSingle()
      if (error || !data) {
        if (error) console.warn('[stemrobin] getLesson failed:', error.message)
        return null
      }
      const r = data as {
        id: string
        subject: 'math' | 'physics'
        stage: number
        lesson_order: number
        title: string
        concept: string
        status: 'draft' | 'published'
      }
      return {
        id: r.id,
        subject: r.subject,
        stage: r.stage,
        order: r.lesson_order,
        title: r.title,
        concept: r.concept,
        status: r.status,
      }
    } catch (e) {
      console.warn('[stemrobin] getLesson error:', (e as Error).message)
      return null
    }
  })
