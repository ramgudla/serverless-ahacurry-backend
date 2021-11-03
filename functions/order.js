var AWS = require("aws-sdk");
const utils = require('./utils');

module.exports.handler = async (event) => {
  let order = JSON.parse(event.Records[0].Sns.Message)

  // place order
  const MAX_RETRIES = 3;
  const wait = 1000;
  const table = 'aha-unit-transaction-dynamo-db';
  await utils.retryPromiseWithDelay(utils.putItem(table, order), MAX_RETRIES, wait).then((data) => {
    console.log('Order placed successfully.', data);
  }, (ex) => {
     console.log('Error in placing order.');
     console.dir(ex.message);
     throw new Error('Couldn\'t put the order into dynamodb due to an internal error.');
  });

  // send SMS
  const smsParams = {
    Message: `Dear Customer, Your order is placed successfully. \r\nTransaction id is: ${order.transactionId}. \r\nTotal Amount is: $ ${order.grandTotal}`,
    PhoneNumber: order.phoneNumber
  }

  await utils.sendSMS(smsParams).then((data) => {
    console.log('Message sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending Message.');
     console.dir(ex.message);
  });

  // send Email
 const emailTemplateData = JSON.stringify({
     name: order.shipping.name,
     transactionId: order.transactionId,
     amount: order.grandTotal
 })
 const emailParams = {
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
                   ReplacementTemplateData: emailTemplateData
                 },
              /* more items */
      ],
     Source: `Superior Foods <${order.email}>`, /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: "{ \"name\":\"unknown\", \"transactionId\":\"unknown\", \"amount\":\"unknown\"  }"
  };
  await utils.sendEmail(emailParams).then(() => {
    console.log('Email sent successfully.');
  }, (ex) => {
     console.log('Error in sending email.');
     console.dir(ex.message);
  });

}
