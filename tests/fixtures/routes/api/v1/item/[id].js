'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ id: req.params.id });
  },
  patch: async (req, res) => {
    res.status(200).json({ updated: req.params.id });
  },
  delete: async (req, res) => {
    res.status(204).send();
  },
};

module.exports = { route };
