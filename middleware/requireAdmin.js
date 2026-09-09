import jwt from 'jsonwebtoken';

export default function requireAdmin(req, res, next) {
  // Shared-key auth: the admin panel sends the key it was given as `x-admin-key`.
  // Accept it when it matches ADMIN_API_KEY so the single-key login box works.
  const sharedKey = process.env.ADMIN_API_KEY;
  if (sharedKey && req.headers['x-admin-key'] === sharedKey) {
    req.admin = { via: 'shared-key' };
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin login required' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'bookastay_secret');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
  }
}
