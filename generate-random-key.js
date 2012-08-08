const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz',
      DEFAULT_NUM_CHARS = 5;

module.exports = function(alphabet, numChars) {
  var key = '',
      alphabet = alphabet || DEFAULT_ALPHABET,
      numChars = numChars || DEFAULT_NUM_CHARS;

  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Math/random
  // Returns a random integer between min and max  
  // Using Math.round() will give you a non-uniform distribution!  
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;  
  }
  
  for (var i = 0; i < numChars; i++)
    key += alphabet[getRandomInt(0, alphabet.length-1)];
  
  return key;
};
