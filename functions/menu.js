const AWS = require('aws-sdk');
const utils = require('./utils');

module.exports.handler = (event, context, callback) => {
  // ddb service sdkv2
  const params1 = {
    TableName: process.env.MENU_TABLE_NAME,
    Key: {
      restaurantId: {
        S: event.pathParameters.restaurantId
      },
    }
  };

  // documentClient
  var params = {
      Key: {
       restaurantId: event.pathParameters.restaurantId,
      },
      TableName: process.env.MENU_TABLE_NAME
  };

  utils.getItem(params).then((data) => {
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

};
