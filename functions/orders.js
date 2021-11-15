const AWS = require('aws-sdk');
const utils = require('./utils');

const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME;

const handleGet = (event, callback) => {
  if (event.pathParameters && event.pathParameters.phoneNumber && event.pathParameters.transactionId) {
    return getOrder(event, callback);
  }
  return getOrders(event, callback);

}

const handlePost = (event, callback) => {
  if (event.resource === '/api/v1/caterings') {
    return notifyCateringRequest(event, callback);
  }
  if (event.resource === '/api/v1/orders') {
    return insertOrder(event, callback);
  }
  return updateOrder(event, callback);

}

const insertOrder = (event, callback) => {
  const requestBody = JSON.parse(event.body);
  const order = requestBody.order;
  // place order
  var ddParams = {
    TableName: ORDERS_TABLE_NAME,
    Item: order
  };
  utils.putItem(ddParams).then((data) => {
    console.log('Order placed successfully.', data);
    let message = {
      statusCode: 200,
      message: `Your order request has been taken.`
    };
    response = utils.generateResponse(200, message);
    callback(null, response);
  }, (ex) => {
     console.log('Error in placing order.');
     console.dir(ex.message);
     let message = {
       message: ex.message
     };
     response = utils.generateResponse(500, message);
     callback(null, response);
  });

}

const updateOrder = (event, callback) => {
  const requestBody = JSON.parse(event.body);
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

const getOrder = (event, callback) => {
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

const getOrders = (event, callback) => {
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
      message: `${ex.message}. Only 'status=[New, InProgress, Completed]' query parameter is valid.`
    };
    response = utils.generateResponse(500, message);
    callback(null, response);
  });

}

const notifyCateringRequest = (event, callback) => {
  const requestBody = JSON.parse(event.body);
  // send SMS
  const smsParams = {
    Message: `Dear ${requestBody.catering.name}, \r\nYour catering request has been taken. We will reach you shortly on your mobile number: ${requestBody.catering.phoneNumber}`,
    PhoneNumber: requestBody.catering.phoneNumber
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
           name: requestBody.catering.name,
           phoneNumber: requestBody.catering.phoneNumber,
           email: requestBody.catering.email,
           description: requestBody.catering.description
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
                                     requestBody.catering.email
                                   ],
                      CcAddresses: [
                                     requestBody.catering.email
                                   ]
                   },
                   ReplacementTemplateData: emailTemplateData
                 },
              /* more items */
      ],
     Source: `Superior Foods <${requestBody.catering.email}>`, /* required */
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
    message: `Dear ${requestBody.catering.name}, Your catering request has been taken. We will reach you shortly on your mobile number: ${requestBody.catering.phoneNumber}`
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
