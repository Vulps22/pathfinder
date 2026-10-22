'use strict';

// Exported the route object directly instead of as `route`
module.exports = {
  get: async (req, res) => {
    res.status(200).json({ users: [] });
  },
};
