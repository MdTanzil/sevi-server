const { categoriesCollection } = require("../config/db");

//get all categories
const getCategories = async (req, res) => {
  const result = await categoriesCollection.find().toArray();
  res.send(result);
};

module.exports = { getCategories };
