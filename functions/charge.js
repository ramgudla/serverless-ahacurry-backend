const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: 'us-east-2' });

const publishSnsTopic = async (data) => {
  const params = {
    Message: JSON.stringify(data),
    TopicArn: 'arn:aws:sns:us-east-2:205453592122:orders-topic'
  }

  return new Promise((resolve, reject) => {
    sns.publish(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

const generateResponse = (code, payload) => {
  console.log(payload)
  return {
    statusCode: code,
    headers: {
        "Content-Type" : "application/json",
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Methods" : "OPTIONS,POST",
        "Access-Control-Allow-Credentials" : true,
        "Access-Control-Allow-Origin" : "*",
        "X-Requested-With" : "*"
    },
    body: JSON.stringify(payload)
  }
}

const verifyOrderAmount = (order, amt) => {
  return order.items.reduce((accu, item) => accu + item.unitPrice*item.quantity, 0) === amt;
}

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

  if (verifyOrderAmount(order, amount) === false) {
    console.log("Order amount is modified in transit.");
    let message = {
      message: `Your ordered amount doesn't match with total amount. Order is declined.`,
    };
    response = generateResponse(400, message);
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

    publishSnsTopic(order).then((data) => {
     console.log('Message published successfully.', data);
    }, (ex) => {
      console.log('Error in publishing Message.');
      console.dir(ex.message);
      // post the order into error-queue?
    });

    let message = {
      message: `Your transaction is successful.`,
      charge,
    };
    response = generateResponse(200, message);
    callback(null, response);
  }, (ex) => {
    console.log(ex);
    let message = {
      message: ex.message
    };
    response = generateResponse(500, message);
    callback(null, response);
  });

};
