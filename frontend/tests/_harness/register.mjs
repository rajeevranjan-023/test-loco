import { register } from 'node:module'
import './setup.mjs'
register('./loader.mjs', import.meta.url)
