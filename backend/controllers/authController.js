import * as authService from "../services/authService.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const result = await authService.loginWithPassword(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await authService.changePassword(
      req.user.userId,
      currentPassword,
      newPassword
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};
