// Pós-processa o CSS gerado pelo Tailwind v4 para funcionar em Safari/iOS antigos.
//
// O Tailwind v4 usa recursos que iOS < 16.4 não entende. O pior é o cascade
// layers (`@layer`): em iOS < 15.4 o Safari ignora TODAS as regras dentro de um
// @layer, deixando a página completamente sem estilo. Aqui:
//   1. postcss-cascade-layers  → achata os @layer em regras normais (com a
//      especificidade ajustada) para que apliquem sem suporte a cascade layers.
//   2. postcss-oklab-function  → converte oklch()/oklab() em rgb (Safari < 15.4).
//   3. postcss-color-mix-function → fallback para color-mix() (Safari < 16.2).
//
// @property (Safari < 16.4) é deixado como está: at-rules não suportadas são
// simplesmente ignoradas, sem quebrar o resto do CSS.
import postcssOklab from '@csstools/postcss-oklab-function'
import postcssColorMix from '@csstools/postcss-color-mix-function'
import postcssCascadeLayers from '@csstools/postcss-cascade-layers'

export default {
  plugins: [
    postcssOklab({ preserve: false }),
    postcssColorMix({ preserve: true }),
    postcssCascadeLayers(),
  ],
}
