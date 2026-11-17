const fs = require('fs');
const path = require('path');

const initialDataPath = path.join(__dirname, '../src/data/initialData.ts');
let content = fs.readFileSync(initialDataPath, 'utf8');

// 1. Reset products sales and reviews to 0
const prodStartToken = 'export const INITIAL_PRODUCTS: Product[] = ';
const prodEndToken = '\n];\n\nexport const INITIAL_ORDERS';

const prodStartIndex = content.indexOf(prodStartToken);
const prodEndIndex = content.indexOf(prodEndToken, prodStartIndex);

if (prodStartIndex === -1 || prodEndIndex === -1) {
  console.error('Tokens for products not found');
  process.exit(1);
}

const prefix = content.slice(0, prodStartIndex + prodStartToken.length);
const middle = content.slice(prodStartIndex + prodStartToken.length, prodEndIndex + 2);
const suffix = content.slice(prodEndIndex + 2);

const products = JSON.parse(middle);
const cleanedProducts = products.map(p => ({
  ...p,
  salesCount: 0,
  unitsSold: 0,
  rating: 0,
  reviewCount: 0
}));

// 2. Clean INITIAL_ORDERS to empty array for real-time tracking from zero
let newSuffix = suffix;
const orderStartToken = ': Order[] = [';
const orderEndToken = '];\n\nexport const INITIAL_COUPONS';
const orderStartIndex = newSuffix.indexOf(orderStartToken);
const orderEndIndex = newSuffix.indexOf(orderEndToken, orderStartIndex);

if (orderStartIndex !== -1 && orderEndIndex !== -1) {
  const orderPrefix = newSuffix.slice(0, orderStartIndex + orderStartToken.length);
  const orderSuffix = newSuffix.slice(orderEndIndex);
  newSuffix = orderPrefix + '\n' + orderSuffix;
}

const finalFileContent = prefix + JSON.stringify(cleanedProducts, null, 2) + newSuffix;
fs.writeFileSync(initialDataPath, finalFileContent, 'utf8');

console.log(`Successfully reset ${cleanedProducts.length} products to 0 sales, 0 reviews, 0 ratings and initialized clean orders!`);
