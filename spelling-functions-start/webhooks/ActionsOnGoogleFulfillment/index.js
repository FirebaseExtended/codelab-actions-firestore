// index.js
const {conversation} = require('@assistant/conversation');
const functions = require('firebase-functions');

const app = conversation();

app.handle('sellingBeeTest', conv => {
  conv.add('questionOnEnterFunc triggered on webhook');
});

app.handle('spellingBeePractice', conv => {
  conv.add('fruitSlotValidationFunc triggered on webhook');
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
