import { Router } from 'express';
import { touchUser, getUser, attachProfile } from '../users.js';

const router = Router();

// GET /api/users/me?userId=  -> current account's profile (auto-created if new)
router.get('/me', (req, res) => {
  const { userId = 'guest' } = req.query;
  touchUser(userId);
  res.json(getUser(userId));
});

// POST /api/users/profile { userId, email?, displayName? }
// Not an auth endpoint — just attaches optional profile info to a user id.
// This is the seam a future login flow hooks into: once you have real
// authentication, call this (or replace it) to save email/display_name against
// the account id your auth system hands back.
router.post('/profile', (req, res) => {
  const { userId = 'guest', email, displayName } = req.body;
  const user = attachProfile(userId, { email, displayName });
  res.json(user);
});

export default router;
