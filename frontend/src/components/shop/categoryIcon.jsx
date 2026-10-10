import React from 'react'
import { Milk, Wheat, Cookie, CookingPot, Apple, Sparkles, Package, Pill, Shirt, Hammer, Smartphone, Cake, Droplets, Candy } from 'lucide-react'

// Picks an icon + tint for a product category by keyword — unknown names fall back to a box.
const RULES = [
  [/dairy|milk/i, Milk, 'bg-blue-50 text-blue-500'],
  [/grain|cereal|atta|rice/i, Wheat, 'bg-amber-50 text-amber-500'],
  [/snack|beverage|drink/i, Cookie, 'bg-rose-50 text-rose-500'],
  [/cook|oil|spice/i, CookingPot, 'bg-orange-50 text-orange-500'],
  [/fruit|veg/i, Apple, 'bg-green-50 text-green-500'],
  [/personal|care|beauty/i, Sparkles, 'bg-violet-50 text-violet-500'],
  [/home|clean|detergent/i, Droplets, 'bg-sky-50 text-sky-500'],
  [/medic|pharma|health/i, Pill, 'bg-emerald-50 text-emerald-500'],
  [/cloth|fashion|wear/i, Shirt, 'bg-pink-50 text-pink-500'],
  [/hardware|tool/i, Hammer, 'bg-slate-100 text-slate-500'],
  [/mobile|electronic/i, Smartphone, 'bg-indigo-50 text-indigo-500'],
  [/bake|cake|bread/i, Cake, 'bg-yellow-50 text-yellow-600'],
  [/staple|sugar|salt/i, Candy, 'bg-teal-50 text-teal-500'],
]
export function categoryIcon(name = '') {
  const [, Icon, tone] = RULES.find(([re]) => re.test(name)) || [null, Package, 'bg-gray-100 text-gray-500']
  return { Icon, tone }
}
export function CategoryIcon({ name, size = 18, box = 'h-9 w-9' }) {
  const { Icon, tone } = categoryIcon(name)
  return <span className={`grid shrink-0 place-items-center rounded-lg ${box} ${tone}`}><Icon size={size} strokeWidth={1.8} /></span>
}
