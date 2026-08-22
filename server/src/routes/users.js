import { Router } from 'express';
import { touchUser, getUser, attachProfile } from '../users.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/users/me -> current account's profile (auto-created if new)
router.get('/me', (req, res) => {
  touchUser(req.user.id);
  res.json(getUser(req.user.id));
});

// POST /api/users/profile { email?, displayName? }
router.post('/profile', (req, res) => {
  const { email, displayName } = req.body;
  const user = attachProfile(req.user.id, { email, displayName });
  res.json(user);
});

export default router;
