'use strict';

// Forgot to export `route`
const route = {
  get: async (req, res) => {
    res.status(200).json({ users: [] });
  },
};
