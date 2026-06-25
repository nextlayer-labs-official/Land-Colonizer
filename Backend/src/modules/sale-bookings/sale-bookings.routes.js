const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const { getBookings, createBooking, updateBooking, deleteBooking, confirmBooking } = require('./sale-bookings.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/',               getBookings);
router.post('/',              createBooking);
router.put('/:id',            updateBooking);
router.delete('/:id',         deleteBooking);
router.post('/:id/confirm',   confirmBooking);

module.exports = router;
