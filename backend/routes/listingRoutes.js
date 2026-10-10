import express from 'express'
import { listShops, listServices } from '../controllers/listingController.js'
import { listAllProducts } from '../controllers/productController.js'

const router = express.Router()

router.get('/shops', listShops)
router.get('/services', listServices)
router.get('/products', listAllProducts)

export default router   
