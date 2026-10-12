import mongoose from 'mongoose'

// One purchase/restock of a product. Same product → many batches, each with its own cost price.
// Selling always drains the OLDEST batch first (FIFO) — see utils/stock.js.
const batchSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 0 },      // total received in this batch
    remainingQty: { type: Number, required: true, min: 0 },  // still on the shelf
    costPrice: { type: Number, required: true, min: 0 },     // what this batch cost per unit
    sellingPrice: { type: Number, default: null, min: 0 },   // selling price in force when this batch was added (history only; the product's `price` is the live one)
    addedAt: { type: Date, default: Date.now },
    exhausted: { type: Boolean, default: false },            // remainingQty hit 0
    exhaustedAt: { type: Date, default: null },
    adjustedQty: { type: Number, default: 0, min: 0 },       // removed by a manual stock correction (not a sale)
    source: { type: String, enum: ['opening', 'restock', 'return'], default: 'restock' },
    note: { type: String, default: '', maxlength: 200 },
    editLog: [{ _id: false, field: String, from: Number, to: Number, at: { type: Date, default: Date.now }, recalculated: { type: Boolean, default: false } }],
  },
  { timestamps: false }
)

const productSchema = new mongoose.Schema(
  {
    productCode: { type: String, default: undefined, trim: true, uppercase: true }, // human product ID, e.g. "A001" (unique per shop)
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'Other', trim: true }, // used by Sales-by-Category
    active: { type: Boolean, default: true },
    // listed:false = typed at the billing counter but not yet in inventory (reviewed in Inventory → "Products Added From Billing")
    listed: { type: Boolean, default: true },
    billedCount: { type: Number, default: 0 },
    lastBilledAt: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    lowStockAt: { type: Number, default: 10 },
    price: { type: Number, required: true, min: 0 },
    priceUnit: { type: String, enum: ['kg', 'liter', 'unit'], default: 'unit' },
    costPrice: { type: Number, required: true, min: 0 },
    costPriceUnit: { type: String, enum: ['kg', 'liter', 'unit'], default: 'unit' },
    stock: { type: Number, required: true, min: 0, default: 0 }, // = totalStock: always the sum of batches[].remainingQty (kept in sync by utils/stock.js)
    batches: { type: [batchSchema], default: [] },
    // Append-only: a cost / price change adds a line, it never rewrites an old one.
    costHistory: { type: [new mongoose.Schema({ costPrice: Number, at: { type: Date, default: Date.now } }, { _id: false })], default: [] },
    priceHistory: { type: [new mongoose.Schema({ price: Number, at: { type: Date, default: Date.now } }, { _id: false })], default: [] },
    sold: { type: Number, default: 0, min: 0 },
    consumed: { type: Number, default: 0, min: 0 }, // used up as a service material (not sold) — same stock, same batches
    sellable: { type: Boolean, default: true },     // false = a part used in services only; hidden from the Product picker, still usable as Material
    icon: { type: String, default: '📦' },
    imageUrl: { type: String, default: '' }, // optional — falls back to `icon` when empty
    videoUrl: { type: String, default: '' }, // optional showcase video
    description: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true, optimisticConcurrency: true } // concurrent stock writes can't silently overwrite each other (see withProduct)
)

// Product IDs are unique inside a shop (partial index → older products without a code are fine).
productSchema.index({ shopId: 1, productCode: 1 }, { unique: true, partialFilterExpression: { productCode: { $type: 'string' } } })
productSchema.index({ shopId: 1, name: 1 })

// Names used in the brief: sellingPrice = price (latest), totalStock = stock.
productSchema.virtual('sellingPrice').get(function sellingPrice() { return this.price })
// Names used in the brief: unit = kg | liter | unit, costPerUnit = latest cost, sellingPricePerUnit = latest selling price.
productSchema.virtual('unit').get(function unit() { return this.priceUnit })
productSchema.virtual('costPerUnit').get(function costPerUnit() { return this.costPrice })
productSchema.virtual('sellingPricePerUnit').get(function sellingPricePerUnit() { return this.price })
productSchema.virtual('totalStock').get(function totalStock() { return this.stock })
// Value of what is actually on the shelf, batch by batch (not stock × latest cost).
productSchema.virtual('stockValue').get(function stockValue() {
  return Math.round((this.batches || []).reduce((s, b) => s + (b.exhausted ? 0 : b.remainingQty * b.costPrice), 0) * 100) / 100
})
// NOTE: the old `profit` virtual ((price − costPrice) × sold) used the LATEST cost for every past sale — it is gone.
// Real profit comes from the Sale lines (costAtSale / costBreakdown), which snapshot the batches actually used.

productSchema.set('toJSON', { virtuals: true })               // convert to json

export default mongoose.model('Product', productSchema)
