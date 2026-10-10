import express from 'express'
import { requireCapability } from '../middleware/auth.js'
import * as S from '../controllers/studyController.js'

// Mounted at /api/seller/study (after protect + requireSeller). Only accounts whose business schema has the
// `seatManagement` capability (study centres) can reach it — shops and service providers get 403.
const router = express.Router()
router.use(requireCapability('seatManagement'))

router.get('/config', S.getConfig)
router.put('/config', S.updateConfig)
router.post('/config/:list', S.addToList)
router.put('/config/:list/:key', S.updateInList)
router.delete('/config/:list/:key', S.removeFromList)

router.get('/seats', S.listSeats)
router.post('/seats', S.createSeats)
router.patch('/seats/:id', S.updateSeat)
router.delete('/seats/:id', S.deleteSeat)
router.post('/seats/:id/assign', S.assignToSeat)
router.post('/assignments/release', S.releaseMany)
router.post('/assignments/:id/release', S.releaseSeat)
router.post('/assignments/:id/reassign', S.reassign)

router.get('/members', S.listMembers)
router.post('/members', S.createMember)
router.get('/members/:id', S.memberDetail)
router.patch('/members/:id', S.updateMember)
router.get('/members/:id/renewal-offer', S.renewalOffer)

router.get('/courses', S.listCourses)
router.post('/courses', S.createCourse)
router.patch('/courses/:id', S.updateCourse)
router.delete('/courses/:id', S.deleteCourse)
router.get('/courses/:id/enrollments', S.courseEnrollments)

router.get('/dashboard', S.dashboard)
router.get('/analytics', S.analytics)
router.get('/billing/catalog', S.billingCatalog)
export default router
