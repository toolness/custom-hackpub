var expect = require('expect.js');
var generateRandomKey = require('../generate-random-key');

describe("generateRandomKey()", function() {
  it("should work w/ no args", function() {
    expect(generateRandomKey()).to.match(/[a-z]+/);
  });

  it("should work w/ explicit args", function() {
    expect(generateRandomKey(['a'], 3)).to.be('aaa');
    expect(generateRandomKey(['abc'], 3)).to.match(/[abc]+/);
  });
});
