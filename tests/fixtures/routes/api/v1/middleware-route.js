'use strict';

const route = {
  middleware: [
    (req, res, next) => {
      req.middlewareRan = true;
      next();
    },
  ],
  get: async (req, res) => {
    res.status(200).json({ middlewareRan: req.middlewareRan ?? false });
  },
};

module.exports = { route };
