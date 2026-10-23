'use strict';

const route = {
  get: async (req, res) => {
    res.status(200).json({ method: 'get' });
  },
  head: async (req, res) => {
    res.set('X-Handler', 'head').status(200).end();
  },
  options: async (req, res) => {
    res.set('Allow', 'GET, HEAD, OPTIONS').status(204).end();
  },
};

module.exports = { route };
