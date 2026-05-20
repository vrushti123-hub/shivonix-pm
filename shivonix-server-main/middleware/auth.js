const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.user.homeBoardId = decoded.boardId;
    // Use X-Board-Id header if provided (for shared board switching)
    const headerBoardId = req.headers['x-board-id'];
    if (headerBoardId && headerBoardId.trim() !== '') {
      req.user.boardId = headerBoardId;
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
