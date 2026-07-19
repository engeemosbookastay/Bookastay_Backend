import jwt from 'jsonwebtoken';

export default function requireAdmin(req, res, next) {
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
