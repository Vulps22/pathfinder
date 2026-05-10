'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ pong: true });
  },
};

module.exports = { route };
