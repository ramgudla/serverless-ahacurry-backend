var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: 'us-east-2' })
const ses = new AWS.SES({ region: 'us-east-2' })

const sendSMS = async (message) => {
  const params = {
    Message: `Dear Customer, Your order is placed successfully. Transaction id is: ${message.transactionId}. Total Amount is: $ ${message.amount}`,
    PhoneNumber: message.phoneNumber
  }

  return new Promise((resolve, reject) => {
    sns.publish(params, (err, data) => {
      if (err) {
        //console.log('Could not send message.', err);
        return reject(err);
      } else {
        //console.log('Message sent successfully.', data);
        return resolve(data);
      }
    });
  });
}

const sendEmail = async (message) => {
  const templateData = JSON.stringify({
     name: message.name,
     transactionId: message.transactionId,
     amount: message.amount
  })
  const params = {
       Destinations: [/* required */
                {
                   Destination: {
                      ToAddresses: [
                                     message.email
                                   ],
                      CcAddresses: [
                                     message.email
                                   ]
                   },
                   ReplacementTemplateData: templateData
                 },
              /* more items */
      ],
     Source: `Superior Foods <${message.email}>`, /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: "{ \"name\":\"unknown\", \"transactionId\":\"unknown\", \"amount\":\"unknown\"  }"
 };
 console.log(JSON.stringify(params))
 await ses.sendBulkTemplatedEmail(params).promise();
}

module.exports.handler = async (event) => {
  let message = JSON.parse(event.Records[0].Sns.Message)

  // send SMS
  await sendSMS(message).then((data) => {
    console.log('Message sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending Message.');
     console.dir(ex.message);
  });

  // send Email
  await sendEmail(message).then(() => {
    console.log('Email sent successfully.');
  }, (ex) => {
     console.log('Error in sending email.');
     console.dir(ex.message);
  });
}
