const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: 'us-east-2' });

var documentClient = new AWS.DynamoDB.DocumentClient();

const publishSnsTopic = async (data) => {
  const params = {
    Message: JSON.stringify(data),
    TopicArn: 'arn:aws:sns:us-east-2:205453592122:orders-topic'
  }

  return new Promise((resolve, reject) => {
    sns.publish(params, (err, data) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
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
  const phoneNumber = order.phoneNumber;
  const shipping = requestBody.order.shipping;

  if (verifyOrderAmount(order, amount) === false) {
    console.log("Order amount is modified in transit.");
    let response = {
      statusCode: 400,
      //headers: {
      //  'Access-Control-Allow-Origin': '*',
      //},
      headers: {
          "Content-Type" : "application/json",
          "Access-Control-Allow-Headers" : "Content-Type",
          "Access-Control-Allow-Methods" : "OPTIONS,POST",
          "Access-Control-Allow-Credentials" : true,
          "Access-Control-Allow-Origin" : "*",
          "X-Requested-With" : "*"
      },
      body: JSON.stringify({
        message: `Your ordered amount doesn't match with total amount. Order is declined.`,
      }),
    };
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

    // publish to Topic
    const message = {
      amount,
      transactionId,
      name: shipping.name,
      phoneNumber,
      email: order.email
    }
    publishSnsTopic(message).then(() => {
      console.log('Message published successfully.');
    }, (ex) => {
       console.log('Error in publishing Message.');
       console.dir(ex.message);
    });

    console.log("Placing order into db: ", JSON.stringify(order, null, 2));
    var params = {
      TableName: "aha-unit-transaction-dynamo-db",
      Item: order
    };
    documentClient.put(params, function(err, data) {
      if (err) {
          // probably, put the order into a queue?
          console.error("Unable to add order. Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("Added order:", JSON.stringify(data, null, 2));
      }
    });
    const response = {
      statusCode: 200,
      //headers: {
      //  'Access-Control-Allow-Origin': '*',
      //},
      headers: {
          "Content-Type" : "application/json",
          "Access-Control-Allow-Headers" : "Content-Type",
          "Access-Control-Allow-Methods" : "OPTIONS,POST",
          "Access-Control-Allow-Credentials" : true,
          "Access-Control-Allow-Origin" : "*",
          "X-Requested-With" : "*"
      },
      body: JSON.stringify({
        message: `Charge processed succesfully!`,
        charge,
      }),
    };
    callback(null, response);
  })
  .catch((err) => { // Error response
    console.log(err);
    const response = {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: err.message,
      }),
    };
    callback(null, response);
  })
};
