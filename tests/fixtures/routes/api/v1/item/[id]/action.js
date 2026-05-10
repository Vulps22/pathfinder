'use strict';

const route = {
  post: async (req, res) => {
    res.status(200).json({ action: true, id: req.params.id });
  },
};

module.exports = { route };
