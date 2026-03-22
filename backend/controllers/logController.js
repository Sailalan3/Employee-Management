import BlockchainLog from "../models/BlockchainLog.js";

export const list = async (req, res, next) => {
  try {
    const { eventName, limit = 100, skip = 0 } = req.query;
    const query = {};
    if (eventName) query.eventName = eventName;

    const lim = Math.min(Number(limit) || 100, 500);
    const sk = Math.max(0, Number(skip) || 0);

    const [logs, total] = await Promise.all([
      BlockchainLog.find(query)
        .sort({ blockNumber: -1, logIndex: -1 })
        .skip(sk)
        .limit(lim),
      BlockchainLog.countDocuments(query),
    ]);
    res.json({ logs, total, limit: lim, skip: sk });
  } catch (err) {
    next(err);
  }
};
