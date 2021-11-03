const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const utils = require('./utils');

module.exports.handler = (event, context, callback) => {
  console.log('createCharge');
  console.log(event);
  const requestBody = JSON.parse(event.body);
  console.log(requestBody);

  const token = requestBody.token.id;
  const amount = requestBody.charge.amount;
  const currency = requestBody.charge.currency;
  const order = requestBody.order;
  const shipping = requestBody.order.shipping;

  if (utils.verifyOrderAmount(order, amount) === false) {
    console.log("Order amount is modified in transit.");
    let message = {
      message: `Your ordered amount doesn't match with total amount. Order is declined.`,
    };
    response = utils.generateResponse(400, message);
    //context.fail(JSON.stringify(failResponse));
    return callback(null, response);
  }

  return stripe.charges.create({ // Create Stripe charge with token
    amount: Math.round(amount*100),
    currency,
    shipping,
    description: 'Stripe Test charge',
    source: token
  })
  .then((charge) => { // Success response
    console.log(charge);
    transactionId = charge.id;
    order.transactionId = transactionId;
    order.date = new Date().toISOString();

    const MAX_RETRIES = 3;
    const wait = 1000;
    const topic = 'arn:aws:sns:us-east-2:205453592122:orders-topic'
    utils.retryPromiseWithDelay(utils.publishSnsTopic(order, topic), MAX_RETRIES, wait).then((data) => {
     console.log('Message published successfully.', data);
    }, (ex) => {
      console.log('Error in publishing Message.');
      console.dir(ex.message);
    });

    let message = {
      message: `Your transaction is successful.`,
      charge,
    };
    response = utils.generateResponse(200, message);
    callback(null, response);
  }, (ex) => {
    console.log(ex);
    let message = {
      message: ex.message
    };
    response = utils.generateResponse(500, message);
    callback(null, response);
  });

};
