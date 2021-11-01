var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: 'us-east-2' })
const ses = new AWS.SES({ region: 'us-east-2' })

var documentClient = new AWS.DynamoDB.DocumentClient();

const sendSMS = async (order) => {
  const params = {
    Message: `Dear Customer, Your order is placed successfully. Transaction id is: ${order.transactionId}. Total Amount is: $ ${order.grandTotal}`,
    PhoneNumber: order.phoneNumber
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

const sendEmail = async (order) => {
  const templateData = JSON.stringify({
     name: order.shipping.name,
     transactionId: order.transactionId,
     amount: order.grandTotal
  })
  const params = {
       Destinations: [/* required */
                {
                   Destination: {
                      ToAddresses: [
                                     order.email
                                   ],
                      CcAddresses: [
                                     order.email
                                   ]
                   },
                   ReplacementTemplateData: templateData
                 },
              /* more items */
      ],
     Source: `Superior Foods <${order.email}>`, /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: "{ \"name\":\"unknown\", \"transactionId\":\"unknown\", \"amount\":\"unknown\"  }"
 };
 return ses.sendBulkTemplatedEmail(params).promise();
}

const placeOrder = async (order) => {
  var params = {
    TableName: "aha-unit-transaction-dynamo-db",
    Item: order
  };
  return new Promise((resolve, reject) => {
    documentClient.put(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
});
}

module.exports.handler = async (event) => {
  let order = JSON.parse(event.Records[0].Sns.Message)

  // send SMS
  await sendSMS(order).then((data) => {
    console.log('Message sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending Message.');
     console.dir(ex.message);
  });

  // send Email
  await sendEmail(order).then(() => {
    console.log('Email sent successfully.');
  }, (ex) => {
     console.log('Error in sending email.');
     console.dir(ex.message);
  });

  // place Order
  await placeOrder(order).then((data) => {
    console.log('Order placed successfully.', data);
  }, (ex) => {
     console.log('Error in placing order.');
     console.dir(ex.message);
     throw new Error('Couldn\'t put the order into dynamodb due to an internal error.');
  });

}
