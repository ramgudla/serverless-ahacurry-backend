const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: 'us-east-2' })
const ses = new AWS.SES({ region: 'us-east-2' })

// -----------------------------------------
// Create the document client interface for DynamoDB
// https://medium.com/@_bengarrison/javascript-es8-introducing-async-await-functions-7a471ec7de8a
// https://www.hacksparrow.com/nodejs/exports-vs-module-exports.html
// aws ses create-template --cli-input-json file:////Users/ramgudla/Desktop/Bugs/serverless-stripe-backend/mytemplate.json
// aws ses update-template --cli-input-json file:////Users/ramgudla/Desktop/Bugs/serverless-stripe-backend/mytemplate.json
var documentClient = new AWS.DynamoDB.DocumentClient();

async function publishSnsTopic (data) {
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

async function sendMessage (message, phoneNumber) {
  const params = {
    Message: message,
    PhoneNumber: phoneNumber
  }

  return new Promise((resolve, reject) => {
    sns.publish(params, (err, data) => {
      if (err) {
        console.log('Could not send message.', err);
        return reject(err);
      } else {
        console.log('Message sent successfully.', data);
        return resolve(data);
      }
    });
  });
}

async function sendEmail () {
  const templateData = JSON.stringify({
     name: 'Ramakrishna',
     transactionId: 'asdfpqrs',
     amount: 29.75
  })
  const params = {
       Destinations: [/* required */
                {
                   Destination: {
                      ToAddresses: [
                                     "ramkygudla@gmail.com"
                                   ],
                      CcAddresses: [
                                     "ramkygudla@gmail.com"
                                   ]
                   },
                   ReplacementTemplateData: templateData
                 },
              /* more items */
      ],
     Source: 'Superior Foods <ramkygudla@gmail.com>', /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: "{ \"name\":\"unknown\", \"email\":\"unknown\", \"phone\":\"unknown\"  }"
 };
 console.log(JSON.stringify(params))
 await ses.sendBulkTemplatedEmail(params).promise();
}

const emailFunction = async () => {
  const templateData = JSON.stringify({
     name: 'Ramakrishna',
     transactionId: 'asdfpqrs',
     amount: 29.75
  })
  const params = {
       Destinations: [/* required */
                {
                   Destination: {
                      ToAddresses: [
                                     "ramkygudla@gmail.com"
                                   ],
                      CcAddresses: [
                                     "ramkygudla@gmail.com"
                                   ]
                   },
                   ReplacementTemplateData: templateData
                 },
              /* more items */
      ],
     Source: 'Superior Foods <ramkygudla@gmail.com>', /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: "{ \"name\":\"unknown\", \"transactionId\":\"unknown\", \"amount\":\"unknown\"  }"
 };
 console.log(JSON.stringify(params))
 await ses.sendBulkTemplatedEmail(params).promise();
}

function verifyOrderAmount (order, amt) {
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
    let errorResponse = {
      statusCode: 400,
      //headers: {
      //  'Access-Control-Allow-Origin': '*',
      //},
      headers: {
          "Content-Type" : "application/json",
          "Access-Control-Allow-Headers" : "Content-Type",
          "Access-Control-Allow-Methods" : "OPTIONS,POST",
          "Access-Control-Allow-Credentials" : true,
          "Access-Control-Allow-Origin" : "http://localhost:3000",
          "X-Requested-With" : "*"
      },
      body: JSON.stringify({
        message: `Your ordered amount doesn't match with total amount. Order is declined.`,
      }),
    };
    //context.fail(JSON.stringify(failResponse));
    return callback(null, errorResponse);
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

    // publish to topic
    //try {
    //  const successMsg = {
    //    amount,
    //    transactionId,
    //    phoneNumber
    //  }
    //  publishSnsTopic(successMsg);
      //sendEmail();
      //sendMessage(`Dear Customer, Your order is placed successfully. Transaction id is: ${transactionId}. Total Amount is: $ ${amount}`, phoneNumber);
    //} catch (err) {
    //  console.log('Couldn\'t publish message due to an internal error.');
    //}

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

    // send SMS
    const sms = `Dear Customer, Your order is placed successfully. Transaction id is: ${transactionId}. Total Amount is: $ ${amount}`
    sendMessage(sms, phoneNumber).then(() => {
      console.log('Message sent successfully.');
    }, (ex) => {
       console.log('Error in sending Message.');
       console.dir(ex.message);
    });

    // send Email
    emailFunction().then(() => {
      console.log('template created successfully.');
    }, (ex) => {
       console.log('Error in template creation.');
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
          console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("Added item:", JSON.stringify(data, null, 2));
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
          "Access-Control-Allow-Origin" : "http://localhost:3000",
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
