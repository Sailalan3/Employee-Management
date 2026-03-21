import Review from "../models/Review.js";

export const list = async (req, res, next) => {
  try {
    const { employeeId, period } = req.query;
    const query = {};
    if (employeeId) query.employeeId = Number(employeeId);
    if (period) query.period = period;
    const records = await Review.find(query).sort({ createdAt: -1 });
    res.json({ records });
  } catch (err) {
    next(err);
  }
};

export const upsert = async (req, res, next) => {
  try {
    const { employeeId, period, rating, strengths, improvements, feedback, goals } =
      req.body || {};
    if (!employeeId || !period || rating === undefined) {
      return res
        .status(400)
        .json({ error: "employeeId, period, rating are required" });
    }
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }
    const doc = await Review.findOneAndUpdate(
      { employeeId: Number(employeeId), period },
      {
        $set: {
          employeeId: Number(employeeId),
          period,
          rating: r,
          strengths,
          improvements,
          feedback,
          goals,
          reviewerAddress: req.user?.walletAddress,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ review: doc });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const doc = await Review.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
