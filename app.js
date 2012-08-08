var express = require('express');
var knox = require('knox');
var generateRandomKey = require('./generate-random-key');

var app = express.createServer();

app.MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE || '1048576');
app.knox = knox;
app.log = console.log;

function putIntoRandomLocation(s3, content, options, cb) {
  function tryAnotherLocation() {
    return putIntoRandomLocation(s3, content, options, cb);
  }
  
  var candidateLoc = '/' + generateRandomKey();
  s3.get(candidateLoc).on('response', function(isTakenRes) {
    if (isTakenRes.statusCode != 404)
      return tryAnotherLocation();

    var putReq = s3.put(candidateLoc, options);
    putReq.on('response', function(putRes) {
      if (putRes.statusCode == 200)
        cb(null, {
          id: candidateLoc.slice(1),
          location: candidateLoc
        });
      else
        cb('put error - ' + putRes.statusCode, null);
    });
    putReq.end(content);
  }).end();
}

app.use(express.limit(app.MAX_BODY_SIZE));
app.use(express.bodyParser());

app.post('/:key/:secret/:bucket/:domain/publish', function(req, res) {
  // TODO: process original-url too.
  var s3 = app.knox.createClient({
    key: req.params.key,
    secret: req.params.secret.replace(/__slash__/g, '/'),
    bucket: req.params.bucket
  });

  res.header('Access-Control-Allow-Origin', '*');

  if (!(req.body.html && typeof(req.body.html) == 'string'))
    return res.send('html expected', 400);

  var html = new Buffer(req.body.html, 'utf8');

  putIntoRandomLocation(s3, html, {
    'Content-Length': html.length.toString(),
    'Content-Type': 'text/html;charset=utf-8',
    'x-amz-storage-class': 'REDUCED_REDUNDANCY'
  }, function(err, result) {
    if (err)
      res.send({
        message: err
      }, 500);
    else {
      var publishedURL = 'http://' + req.params.domain + result.location;
      app.log("published " + html.length + " bytes to " + publishedURL);
      res.send({'published-url': publishedURL});
    }
  });
});

app.use(express.static(__dirname + '/static'));

module.exports = app;

var port = process.env.PORT || 5000;

if (!module.parent) {
  process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
  });
  
  app.listen(port, function() {
    console.log("Listening on " + port);
  });
}
