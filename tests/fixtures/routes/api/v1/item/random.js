'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ random: true });
  },
};

module.exports = { route };
