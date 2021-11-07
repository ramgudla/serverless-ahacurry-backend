const AWS = require('aws-sdk');
const utils = require('./utils');

const ORDERS_TABLE_NAME = process.env.ORDERS_TABLE_NAME;

function handleGet(event, callback) {
  // documentClient
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
       item: JSON.stringify(data.Item),
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
     items: JSON.stringify(data.Items),
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
            ":st": requestBody.order.status
        },
        ReturnValues:"UPDATED_NEW"
    };

  utils.updateItem(updateParams).then((data) => {
   console.log('Updated Item successfully. New Item: ', data);
   let message = {
     statusCode: 200,
     item: JSON.stringify(data.Items),
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
