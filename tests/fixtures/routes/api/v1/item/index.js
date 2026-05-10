'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ items: [] });
  },
  post: async (req, res) => {
    res.status(201).json({ created: true });
  },
};

module.exports = { route };
