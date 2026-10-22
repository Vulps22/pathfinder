'use strict';

const route = {
  get: async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, Number(req.query.ms ?? 100)));
    res.status(200).json({ done: true });
  },
};

module.exports = { route };
