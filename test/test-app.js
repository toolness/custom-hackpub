var expect = require('expect.js');
var request = require('supertest');
var app = require('../app');

app.log = function() {};

function setupFakeKnox(options) {
  options = options || {};
  
  if (!options.get)
    options.get = function(loc, cb) {
      cb({statusCode: 404});
    };
  
  if (!options.put)
    options.put = function(loc, options, cb) {
      cb({statusCode: 200});
    };
    
  var self = app.knox = {
    createClient: function(clientOptions) {
      ['key', 'secret', 'bucket'].forEach(function(name) {
        expect(clientOptions[name]).to.be.a('string');
        expect(clientOptions[name]).to.be.ok();
      });
      self.clientOptions = clientOptions;
      return {
        get: function(loc) {
          expect(loc).to.match(/[a-z]+/);
          return {
            on: function(evt, cb) {
              expect(evt).to.be('response');
              process.nextTick(function() {
                options.get(loc, cb);
              });
              return this;
            },
            end: function() {}
          };
        },
        put: function(loc, putOptions) {
          expect(loc).to.match(/[a-z]+/);
          expect(putOptions['Content-Length']).to.be.a('string');
          expect(putOptions['Content-Length']).to.match(/[0-9]+/);
          expect(putOptions['Content-Type'])
            .to.be('text/html;charset=utf-8');
          return {
            on: function(evt, cb) {
              expect(evt).to.be('response');
              process.nextTick(function() {
                options.put(loc, putOptions, cb);
              });
              return this;
            },
            end: function(content) {
              self.putContent = content;
            }
          };
        }
      };
    }
  };
  return self;
}

function simplePublish(options) {
  setupFakeKnox(options);
  return request(app)
    .post('/key/secret/bucket/domain.org/publish')
    .send({html: 'hey\u2026'});
}

describe("POST /key/secret/bucket/domain.org/publish", function() {
  it("should translate slashes in the secret", function(done) {
    setupFakeKnox();
    return request(app)
      .post('/key/a__slash__b__slash__c/bucket/domain.org/publish')
      .send({html: 'hey\u2026'})
      .end(function(err, res) {
        if (err) return done(err);
        expect(app.knox.clientOptions.secret).to.be('a/b/c');
        done();
      })
  });
  
  it("should reject publishes bigger than 1mb", function(done) {
    var buf = new Buffer(app.MAX_BODY_SIZE + 1);
    buf.fill("a");
    setupFakeKnox();
    return request(app)
      .post('/key/secret/bucket/domain.org/publish')
      .send({html: buf.toString()})
      .expect(413, done);
  });
  
  it("should properly configure the s3 client", function(done) {
    simplePublish().end(function(err, res) {
      if (err) return done(err);
      expect(app.knox.clientOptions.key).to.be('key');
      expect(app.knox.clientOptions.secret).to.be('secret');
      expect(app.knox.clientOptions.bucket).to.be('bucket');
      done();
    });
  });
  
  it("should try multiple random ids if necessary", function(done) {
    var firstLoc = null;
    simplePublish({
      get: function(loc, cb) {
        if (!firstLoc) {
          firstLoc = loc;
          cb({statusCode: 200});
        } else {
          expect(loc).to.not.be(firstLoc);
          cb({statusCode: 404});
        }
      }
    }).expect(200, done);
  });
  
  it("should report publishing errors", function(done) {
    simplePublish({
      put: function(loc, options, cb) {
        cb({statusCode: 400});
      }
    }).expect(500, {
        message: 'put error - 400'
      }, done);
  });
  
  it("should publish content", function(done) {
    simplePublish().end(function(err, res) {
      if (err) return done(err);
      expect(app.knox.putContent.toString('utf8'))
        .to.be('hey\u2026');
      done();
    });
  });

  it("should return published url", function(done) {
    simplePublish().end(function(err, res) {
      if (err) return done(err);
      expect(res.body['published-url'])
        .to.match(/^http:\/\/domain\.org\/[a-z]+/);
      done();
    });
  });
  
  it("should return 200 on valid requests", function(done) {
    simplePublish().expect(200, done);
  });

  it("should return 400 on no html", function(done) {
    setupFakeKnox();
    request(app)
      .post('/foo/bar/blap/goof/publish')
      .expect(400, 'html expected', done);
  });
  
  it("should support CORS", function(done) {
    simplePublish().expect('Access-Control-Allow-Origin', '*', done);
  });
});
