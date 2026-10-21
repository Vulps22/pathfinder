'use strict';

const express = require('express');

// Mirrors the common [ jsonBody(), auth.bearer(...) ] ordering: the body is parsed before auth runs.
const route = {
  middleware: [
    express.json(),
    (req, res, next) => {
      if (req.headers['authorization'] !== 'Bearer secret') {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      next();
    },
  ],
  post: async (req, res) => {
    res.status(200).json(req.body);
  },
};

module.exports = { route };
