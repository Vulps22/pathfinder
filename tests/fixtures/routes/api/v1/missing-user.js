'use strict';

const { NotFoundError } = require('../../../../../src/handlers/errors');

const route = {
  get: async (req, res) => {
    throw new NotFoundError('User not found');
  },
};

module.exports = { route };
