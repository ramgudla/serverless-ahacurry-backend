// utility function to cause delay
// and get random value

const delayAndGetRandom = (ms) => {
  return new Promise((resolve, reject) => setTimeout(
    () => {
      const val = Math.trunc(Math.random() * 100);
			//console.log(val)
      resolve(val);
    }, ms
  ));
};

 function fn() {
  const a =  9;
  const b =    delayAndGetRandom(5000);
	//b.catch(console.log)
	//console.log("b")
	console.log(b instanceof Promise);
  b.then(console.log)
	//b.then(console.log)
  const c =  5;
   delayAndGetRandom(10000);

  return a + b * c;
}

// Execute fn
console.log("result", fn());//.then(console.log);

// https://blog.bitsrc.io/understanding-javascript-async-and-await-with-examples-a010b03926ea

// https://tusharsharma.dev/posts/retry-design-pattern-with-js-promises
// https://www.airpair.com/node.js/posts/utilities-for-everyday-node-development
