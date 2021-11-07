var AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: `${process.env.region}` })
const ses = new AWS.SES({ region: `${process.env.region}` })

var documentClient = new AWS.DynamoDB.DocumentClient();

// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GettingStarted.NodeJs.04.html
// Create the DynamoDB service object
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

const publishSnsTopic = async (topicArn, data) => {
  const params = {
    Message: JSON.stringify(data),
    TopicArn: topicArn
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

const putItem = async (params) => {
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

const updateItem = async (params) => {
  return new Promise((resolve, reject) => {
    documentClient.update(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
});
}

const getItem = async (params) => {
  return new Promise((resolve, reject) => {
    documentClient.get(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
});
}

const scan = async (params) => {
  return new Promise((resolve, reject) => {
    documentClient.scan(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
});
}

const putItemV2 = async (params) => {
  return new Promise((resolve, reject) => {
    ddb.putItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
});
}

const getItemV2 = async (params) => {
  return new Promise((resolve, reject) => {
    ddb.getItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        data.Item = AWS.DynamoDB.Converter.unmarshall(data.Item);
        resolve(data);
      }
    });
});
}

const sendSMS = async (params) => {
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

const sendEmail = async (params) => {
 return ses.sendBulkTemplatedEmail(params).promise();
}

const generateResponse = (code, payload) => {
  console.log(payload)
  return {
    statusCode: code,
    headers: {
        "Content-Type" : "application/json",
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Methods" : "OPTIONS,POST",
        "Access-Control-Allow-Credentials" : true,
        "Access-Control-Allow-Origin" : "*",
        "X-Requested-With" : "*"
    },
    body: JSON.stringify(payload)
  }
}

/**
 * Util function to return a promise which is resolved in provided milliseconds
 */
const wait = (ms) => new Promise(resolve => setTimeout(() => resolve(), ms));

const retryPromiseWithDelay = async (promise, maxtries, delayTime, retry = 1) => {
  try {
    const res = await promise;
    return res;
  } catch (e) {
    if (maxtries < retry) {
      console.log(`Tried all the ${maxtries} attemps. It couldn't complete...`);
      return Promise.reject(e);
    }
    console.log('Error occurred.', e.message);
    console.log('retrying attempt: ', retry);
    console.log('Will retry after %d milliseconds: ', retry*delayTime);
    // wait for delayTime amount of time before calling this method again
    await wait(retry*delayTime);
    return retryPromiseWithDelay(promise, maxtries, delayTime, retry + 1);
  }
}

const verifyOrderAmount = (order, amt) => {
  return order.items.reduce((accu, item) => accu + item.unitPrice*item.quantity, 0) === amt;
}

exports.publishSnsTopic = publishSnsTopic;
exports.scan = scan;
exports.putItem = putItem;
exports.getItem = getItem;
exports.updateItem = updateItem;
exports.putItemV2 = putItemV2;
exports.getItemV2 = getItemV2;
exports.sendSMS = sendSMS;
exports.sendEmail = sendEmail;
exports.retryPromiseWithDelay = retryPromiseWithDelay;
exports.generateResponse = generateResponse;
exports.verifyOrderAmount = verifyOrderAmount;
