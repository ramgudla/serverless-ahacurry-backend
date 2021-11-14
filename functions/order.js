var AWS = require("aws-sdk");
const utils = require('./utils');

const MAX_RETRIES = 3;
const wait = 1000;
const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME;

module.exports.handler = async (event) => {
  let order = JSON.parse(event.Records[0].Sns.Message)

  // place order
  var ddParams = {
    TableName: ORDERS_TABLE_NAME,
    Item: order
  };
  await utils.retryPromiseWithDelay(utils.putItem(ddParams), MAX_RETRIES, wait).then((data) => {
    console.log('Order %s is inserted successfully into table %s', data, ORDERS_TABLE_NAME);
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
 const emailTemplateData = JSON.stringify(
 {
   order: {
     name: order.shipping.name,
     transactionId: order.transactionId,
     amount: order.grandTotal
   }
 })

 const defaultTemplateData = JSON.stringify(
 {
   order: {
     name: "unknown",
     transactionId: "unknown",
     amount: "unknown"
   }
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
     DefaultTemplateData: defaultTemplateData
  };
  await utils.sendEmail(emailParams).then((data) => {
    console.log('Email sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending email.');
     console.dir(ex.message);
  });

}
