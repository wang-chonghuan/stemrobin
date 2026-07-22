import { createFileRoute } from '@tanstack/react-router'

import { sql } from '~/lib/db'
import { PRACTICE_AUDIO_NODE } from '~/lib/english'

// 跟读练习音频的下载 (STEMROBIN-108). A plain GET that streams the stored mp3 with an
// attachment header, so the download button is one click and the ~1.4 MB never has to
// become a base64 string in the page (the PDF's route does that, but the PDF is 220 KB).
// Filename is 人定的 shape: mt-<课id>-<课文标题>.mp3.
export const Route = createFileRoute('/english-audio/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rows = await sql()`
          select l.title, a.bytes, a.mime
          from sr_lesson_audio a
          join sr_lessons l on l.id = a.lesson_id
          where a.lesson_id = ${params.id} and a.node_id = ${PRACTICE_AUDIO_NODE}
        `
        if (!rows.length) return new Response('not found', { status: 404 })
        const { title, bytes, mime } = rows[0] as unknown as { title: string; bytes: Buffer; mime: string }
        // Keep the filename to characters every OS accepts; the title is English but a
        // colon or slash in a future one would otherwise break the save dialog.
        const name = `mt-${params.id}-${title}.mp3`.replace(/[\\/:*?"<>|]/g, '-')
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': mime,
            'content-length': String(bytes.length),
            'content-disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
            'cache-control': 'private, max-age=3600',
          },
        })
      },
    },
  },
})
