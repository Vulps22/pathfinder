'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ handler: 'get' });
  },
  all: async (req, res) => {
    res.status(200).json({ handler: 'all', method: req.method });
  },
};

module.exports = { route };
