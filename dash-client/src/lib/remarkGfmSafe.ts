import type { Plugin } from 'unified'
import type { Root } from 'mdast'
// Carrega (somente em tempo de tipo) o augment de `data` com
// micromarkExtensions / fromMarkdownExtensions. Apagado no runtime.
import type {} from 'remark-parse'

import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item'

/**
 * Subconjunto do GFM seguro para Safari/iOS: tabelas, strikethrough e task
 * lists.
 *
 * Substitui o `remark-gfm`, que puxa o `mdast-util-gfm-autolink-literal`. Esse
 * pacote usa um lookbehind de regex — `(?<=^|\s|\p{P}|\p{S})` — para autolinkar
 * e-mails. Lookbehind só existe a partir do Safari/iOS 16.4; em iPhones mais
 * antigos o WebKit lança `SyntaxError: Invalid regular expression: invalid
 * group specifier name` no momento em que o markdown é renderizado.
 *
 * Aqui ativamos apenas as extensões GFM que não dependem de lookbehind. Links
 * em markdown `[texto](url)` continuam funcionando (são do core). O que se perde
 * é o autolink de URLs/e-mails "crus" (sem colchetes), o que é aceitável no chat.
 */
const remarkGfmSafe: Plugin<[], Root> = function () {
  const data = this.data()

  const micromarkExtensions =
    data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])

  micromarkExtensions.push(
    gfmTable(),
    gfmStrikethrough({ singleTilde: false }),
    gfmTaskListItem(),
  )
  fromMarkdownExtensions.push(
    gfmTableFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTaskListItemFromMarkdown(),
  )
}

export default remarkGfmSafe
