import esbuild from 'esbuild'
await esbuild.build({ entryPoints: ['/home/claude/loco/loco/frontend/src/features/analytics/pages/BillPage.jsx'], bundle: true, format: 'esm', platform: 'node', outfile: 'outbill.mjs', loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react','react-dom','react-dom/client','lucide-react'],
  plugins: [{ name: 'stub', setup(b) {
    const map = { 'kit.jsx': 'stubs/kit.jsx', 'CustomerPanel.jsx': 'stubs/panel.jsx', 'react-router-dom': 'stubs/router.jsx', 'useOwnerPath.jsx': 'stubs/owner.jsx' }
    b.onResolve({ filter: /.*/ }, (a) => { for (const k in map) if (a.path.endsWith(k)) return { path: process.cwd() + '/' + map[k] } })
  } }] })
