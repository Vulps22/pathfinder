'use strict';

const route = {
  get: async (req, res) => {
    throw new Error('handler failed');
  },
};

module.exports = { route };
