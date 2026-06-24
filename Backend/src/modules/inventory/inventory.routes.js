const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const {
  getInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
} = require('./inventory.controller');

const router = Router();

router.get('/',    authenticate, getInventory);
router.get('/:id', authenticate, getInventoryById);
router.post('/',   authenticate, createInventory);
router.put('/:id', authenticate, updateInventory);
router.delete('/:id', authenticate, deleteInventory);

module.exports = router;
