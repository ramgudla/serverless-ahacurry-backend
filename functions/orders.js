const AWS = require('aws-sdk');
const utils = require('./utils');

const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME;

function handleGet(event, callback) {
  if (event.pathParameters && event.pathParameters.phoneNumber && event.pathParameters.transactionId) {
    let getParams = {
        TableName: ORDERS_TABLE_NAME,
        Key: {
         phoneNumber: event.pathParameters.phoneNumber,
         transactionId: event.pathParameters.transactionId
        },
        ProjectionExpression: "#n, phoneNumber, transactionId, grandTotal, #orders",
        ExpressionAttributeNames:{
            "#n": "name",
            "#orders": "items"
        }
    };

    utils.getItem(getParams).then((data) => {
     console.log('Retrieved Item successfully.', data);
     let message = {
       statusCode: 200,
       item: data.Item
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

  }

  let scanParams = event.queryStringParameters ? {
    TableName : ORDERS_TABLE_NAME,
    ProjectionExpression: "#n, phoneNumber, transactionId, grandTotal, #orders",
    FilterExpression: "#st = :status",
    ExpressionAttributeNames:{
        "#n": "name",
        "#st": "status",
        "#orders": "items"
    },
    ExpressionAttributeValues: {
        ":status": event.queryStringParameters.status
    }
  }
  :
  {
    TableName : ORDERS_TABLE_NAME,
    ProjectionExpression: "#n, phoneNumber, transactionId, grandTotal, #orders",
    ExpressionAttributeNames:{
        "#n": "name",
        "#orders": "items"
    },
  };

  utils.scan(scanParams).then((data) => {
   console.log('Retrieved Items successfully.', data);
   let message = {
     statusCode: 200,
     items: data.Items
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

}

function handlePost(event, callback) {
  const requestBody = JSON.parse(event.body);
  if (event.resource === '/api/v1/caterings') {
    notifyCateringRequest(requestBody, callback);
  }

  var updateParams = {
        TableName:ORDERS_TABLE_NAME,
        Key:{
            "phoneNumber": event.pathParameters.phoneNumber,
            "transactionId": event.pathParameters.transactionId
        },
        UpdateExpression: "set #st = :st",
        ExpressionAttributeNames:{
            "#st": "status",
        },
        ExpressionAttributeValues:{
            ":st": requestBody.attributes.status
        },
        ReturnValues:"UPDATED_NEW"
    };

  utils.updateItem(updateParams).then((data) => {
   console.log('Updated Item successfully. Updated Attributes: ', data);
   let message = {
     statusCode: 200,
     message: `Item is updated successfully. Updated Attributes: ${JSON.stringify(data)}`
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

}

function notifyCateringRequest(req, callback) {
  // send SMS
  const smsParams = {
    Message: `Dear ${req.catering.name}, \r\nYour catering request has been taken. We will reach you shortly on your mobile number: ${req.catering.phoneNumber}`,
    PhoneNumber: req.catering.phoneNumber
  }

  utils.sendSMS(smsParams).then((data) => {
    console.log('Message sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending Message.');
     console.dir(ex.message);
  });

  // send Email
 const emailTemplateData = JSON.stringify(
  {
       catering: {
           name: req.catering.name,
           phoneNumber: req.catering.phoneNumber,
           email: req.catering.email,
           description: req.catering.description
       }
  })

  const defaultTemplateData = JSON.stringify(
   {
        catering: {
            name: "unknown",
            phoneNumber: "unknown",
            email: "unknown",
            description: "unknown"
        }
   })

 const emailParams = {
       Destinations: [/* required */
                {
                   Destination: {
                      ToAddresses: [
                                     req.catering.email
                                   ],
                      CcAddresses: [
                                     req.catering.email
                                   ]
                   },
                   ReplacementTemplateData: emailTemplateData
                 },
              /* more items */
      ],
     Source: `Superior Foods <${req.catering.email}>`, /* required */
     Template: 'MyTemplate', /* required */
     DefaultTemplateData: defaultTemplateData
  };
  console.log(JSON.stringify(emailParams))
  utils.sendEmail(emailParams).then((data) => {
    console.log('Email sent successfully.', data);
  }, (ex) => {
     console.log('Error in sending email.');
     console.dir(ex.message);
  });

  console.log('Your catering request has been taken.');
  let message = {
    statusCode: 200,
    message: `Dear ${req.catering.name}, \r\nYour catering request has been taken. We will reach you shortly on your mobile number: ${req.catering.phoneNumber}`
  };
  response = utils.generateResponse(200, message);
  callback(null, response);
}

module.exports.handler = (event, context, callback) => {
  switch(event.requestContext.httpMethod) {
  case 'GET':
    handleGet(event, callback);
    break;
  case 'POST':
    handlePost(event, callback);
    break;
  default:
    // code block
  }

};
