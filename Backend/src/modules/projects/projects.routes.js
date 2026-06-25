const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const { getProjects, getProjectById, createProject, updateProject, deleteProject, linkInventory } = require('./projects.controller');

const router = Router();
router.use(authenticate);

router.get('/',    getProjects);
router.get('/:id', getProjectById);
router.post('/',   createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/link-inventory', linkInventory);

module.exports = router;
