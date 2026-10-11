// Node ESM loader used ONLY by tests/_harness/run.mjs (the sandbox that wrote these tests could not run vite/vitest: no native
// esbuild/rollup binaries). It compiles .jsx with Babel (JSX → React.createElement), stubs css/images, and points `vitest` at a shim.
// Under a normal checkout use `npm test` (real vitest); these test files run unchanged in both.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const babel = require('@babel/core')

function jsxPlugin({ types: t }) {
  const nameOf = (n) => {
    if (t.isJSXIdentifier(n)) return /^[a-z]/.test(n.name) ? t.stringLiteral(n.name) : t.identifier(n.name)
    if (t.isJSXMemberExpression(n)) return t.memberExpression(nameOf(n.object), t.identifier(n.property.name))
    throw new Error('unsupported JSX name')
  }
  const text = (raw) => {
    const lines = raw.split(/\r\n|\n|\r/); let out = ''
    lines.forEach((l, i) => { let s = l.replace(/\t/g, ' '); if (i !== 0) s = s.replace(/^[ ]+/, ''); if (i !== lines.length - 1) s = s.replace(/[ ]+$/, ''); if (s) { if (i !== lines.length - 1 && out) out += ' '; out += s } })
    return out
  }
  const children = (kids) => kids.flatMap((c) => {
    if (t.isJSXText(c)) { const v = text(c.value); return v ? [t.stringLiteral(v)] : [] }
    if (t.isJSXExpressionContainer(c)) return t.isJSXEmptyExpression(c.expression) ? [] : [c.expression]
    return [c]
  })
  const create = (type, props, kids) => t.callExpression(t.memberExpression(t.identifier('__R'), t.identifier('createElement')), [type, props, ...kids])
  return {
    visitor: {
      Program: { enter(p) { p.unshiftContainer('body', t.importDeclaration([t.importNamespaceSpecifier(t.identifier('__R'))], t.stringLiteral('react'))) } },
      JSXElement: { exit(p) {
        const { openingElement: o, children: kids } = p.node
        const props = o.attributes.map((a) => {
          if (t.isJSXSpreadAttribute(a)) return t.spreadElement(a.argument)
          const key = a.name.name; let v = a.value
          if (v === null) v = t.booleanLiteral(true); else if (t.isJSXExpressionContainer(v)) v = v.expression
          return t.objectProperty(/^[A-Za-z_$][\w$]*$/.test(key) ? t.identifier(key) : t.stringLiteral(key), v)
        })
        p.replaceWith(create(nameOf(o.name), props.length ? t.objectExpression(props) : t.nullLiteral(), children(kids)))
      } },
      JSXFragment: { exit(p) { p.replaceWith(create(t.memberExpression(t.identifier('__R'), t.identifier('Fragment')), t.nullLiteral(), children(p.node.children))) } },
    },
  }
}

const SHIM = pathToFileURL(fileURLToPath(new URL('./vitest-shim.mjs', import.meta.url))).href
export async function resolve(spec, ctx, next) {
  if (spec === 'vitest') return { url: SHIM, shortCircuit: true }
  return next(spec, ctx)
}
export async function load(url, ctx, next) {
  if (/\.(css)$/.test(url)) return { format: 'module', source: 'export default {}', shortCircuit: true }
  if (/\.(png|svg|webp|jpg|jpeg|gif)$/.test(url)) return { format: 'module', source: 'export default ""', shortCircuit: true }
  if (url.startsWith('file:') && /\/frontend\/(src|tests)\/.*\.jsx$/.test(url)) {
    const code = readFileSync(fileURLToPath(url), 'utf8')
    const out = babel.transformSync(code, { filename: fileURLToPath(url), babelrc: false, configFile: false, sourceType: 'module', parserOpts: { plugins: ['jsx'] }, plugins: [jsxPlugin] })
    return { format: 'module', source: out.code, shortCircuit: true }
  }
  return next(url, ctx)
}
